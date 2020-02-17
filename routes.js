const router = require("express").Router();
const bodyParser = require("body-parser");
var stripe = require("stripe")("sk_test_PO8otmAwilkg5Z8EBXfbt5Ck00uFfGl6ln");
const User = require("./schema").User;

router.use(bodyParser.json());

planName = planID => {
  if (planID === "plan_GimROblRVgZszu") return "Plan 1";
  return "Plan 2";
};
planCredits = planID => {
  if (planID === "plan_GimROblRVgZszu") return 10;
  return 20;
};
oppositePlan = planID => {
  if (planID === "plan_GimROblRVgZszu") return "plan_GimSst3abVRevj";
  return "plan_GimROblRVgZszu";
};

router.post("/register", async (req, res) => {
  let user = new User({
    id: "",
    name: req.body.user.name,
    email: req.body.user.email,
    password: req.body.password,
    phone: req.body.user.phone,
    pmid: "",
    credits: 0
  });
  await user.save().then(user_obj => {
    res.send(user_obj);
  });
});

router.get("/login", async (req, res) => {
  let user = await User.find(
    {
      email: req.query.email,
      password: req.query.password
    },
    err => {
      if (err) console.warn(err);
    }
  );
  res.send(user);
});

router.get("/user/subscriptions", async (req, res) => {
  await stripe.customers.retrieve(req.query.id, (err, customer) => {
    //console.log(customer);
    if (err) console.log(err);
    else if (customer.subscriptions.data.length)
      res.send({
        plan: customer.subscriptions.data[0].items.data[0].plan,
        sub_id: customer.subscriptions.data[0].id
      });
    else res.send({});
  });
});

router.post("/user/subscribe", async (req, res) => {
  await stripe.paymentMethods.create(
    {
      type: "card",
      card: {
        number: req.body.number,
        exp_month: req.body.exp_month,
        exp_year: req.body.exp_year,
        cvc: req.body.cvc
      }
    },
    async (err, paymentMethod) => {
      //console.log(paymentMethod);
      if (err) res.send({ err: err.raw.message });
      else {
        await stripe.customers.create(
          {
            payment_method: paymentMethod.id,
            email: req.body.email,
            name: req.body.name,
            invoice_settings: {
              default_payment_method: paymentMethod.id
            }
          },
          async (err, customer) => {
            if (err) res.send({ err: err.raw.message });
            else
              await User.updateOne(
                {
                  _id: req.body._id
                },
                {
                  $set: {
                    id: customer.id,
                    pmid: paymentMethod.id,
                    credits: planCredits(req.body.plan)
                  }
                },
                async err => {
                  if (err) res.send({ err: "Couldn't update Database" });
                  else {
                    await stripe.subscriptions.create(
                      {
                        customer: customer.id,
                        items: [{ plan: req.body.plan }],
                        expand: ["latest_invoice.payment_intent"]
                      },
                      async (err, subscription) => {
                        if (err) res.send({ err: err.raw.message });
                        else
                          res.send({
                            pmid: paymentMethod.id,
                            id: customer.id,
                            existingPlan: {
                              sub_id: subscription.id,
                              id: subscription.plan.id,
                              name: subscription.plan.nickname
                            },
                            credits:
                              subscription.plan.transform_usage.divide_by,
                            plan: ""
                          });
                      }
                    );
                  }
                }
              );
          }
        );
      }
    }
  );
});

router.post("/user/PlanChange", async (req, res) => {
  let credits = await User.find({ _id: req.body._id }, err =>
    console.log(1, err)
  );
  if (credits.length <= 0) {
    res.send("no");
    return;
  }
  credits = credits[0].credits;

  let planId = req.body.existingPlan.id;
  let newPlanId = req.body.newPlan ? req.body.newPlan : oppositePlan(planId);
  let obj = {
    existingPlan: req.body.existingPlan,
    plan: "",
    credits: credits + planCredits(newPlanId)
  };

  if (planId !== newPlanId) {
    const sub = await stripe.subscriptions.retrieve(
      req.body.existingPlan.sub_id
    );

    await stripe.subscriptions.update(
      req.body.existingPlan.sub_id,
      {
        cancel_at_period_end: false,
        items: [
          {
            id: sub.items.data[0].id,
            plan: newPlanId
          }
        ]
      },
      async (err, resp) => {
        if (err) {
          console.log(2, err);
          obj = "no";
        } else
          obj = {
            existingPlan: {
              sub_id: resp.id,
              id: resp.items.data[0].plan.id,
              name: resp.items.data[0].plan.nickname
            },
            credits:
              credits + resp.items.data[0].plan.transform_usage.divide_by,
            plan: ""
          };
      }
    );
  }
  await User.updateOne(
    { _id: req.body._id },
    { credits: credits + planCredits(newPlanId) },
    err => {
      if (err) {
        console.log(3, err);
        res.send("no");
      } else {
        res.send(obj);
      }
    }
  );
});

router.get("/user/consumeCredit", async (req, res) => {
  let user = await User.find(
    {
      _id: req.query._id
    },
    err => {
      if (err) res.send({ message: "Invalid User", credits: 0 });
    }
  );
  if (user.length <= 0) {
    res.send({ message: "Invalid User", credits: 0 });
    return;
  }
  user = user[0];
  if (user.credits <= 0) {
    res.send({ message: "NOT ENOUGH CREDITS", credits: 0 });
    return;
  }

  await User.updateOne(
    { _id: req.query._id },
    { credits: user.credits - 1 },
    err => {
      if (err) {
        console.warn(err);
        res.send({ message: "Failed", credits: user.credits });
      } else
        res.send({
          message: "Successfuly Consumed",
          credits: user.credits - 1
        });
    }
  );
});

router.get("/user/getInfo", async (req, res) => {
  //console.log(req.query);
  let user = await User.find(
    {
      _id: req.query._id
    },
    err => {
      if (err) res.send([]);
    }
  );
  if (user.length <= 0) res.send([]);
  else res.send(user[0]);
});

router.post("/webhooks", async (req, res) => {
  const signature = req.headers["stripe-signature"];
  try {
    event = await stripe.webhooks.constructEvent(
      req.body,
      signature,
      "whsec_gkgjKQSNDfinQs7QdgFvrKDtgGNWbtBz",
      (err, event) => {
        if (err) {
          //console.log("colbek", err);
          res.send(err);
        } else res.send(event);
      }
    );
  } catch (err) {
    res.send(req);
  }
});

module.exports = router;
