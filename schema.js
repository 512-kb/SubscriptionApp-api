let mongoose = require("mongoose");

var User = mongoose.Schema({
  id: String,
  name: String,
  email: String,
  password: String,
  phone: Number,
  pmid: String,
  credits: Number
});

module.exports.User = mongoose.model("User", User);
