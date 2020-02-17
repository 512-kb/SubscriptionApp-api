const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const routes = require("./routes");
const mongoose = require("mongoose");
const cors = require("cors");
const port = process.env.PORT || 4000;

mongoose.connect(
  "mongodb+srv://512kb:n%2D%25%23Q%2BH%2BEk%25W.y6@mongo-cluster-o7hzs.mongodb.net/test",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }
);
mongoose.connection
  .once("open", () => {
    console.log("Connected to MongoDB");
  })
  .on("error", err => {
    console.log(err);
  });

app.use(
  cors({
    origin: "*",
    credentials: true,
    optionsSuccessStatus: 200
  })
);
app.use(express.static("public"));
app.use(routes);
app.use(bodyParser.json());

app.listen(port, () => console.log("Server listening on port " + port));
