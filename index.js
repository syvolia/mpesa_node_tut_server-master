const express = require("express");

const app = express();
require("dotenv").config();
const cors = require("cors");
const mongoose = require("mongoose");
const axios = require("axios");
const Transaction = require("./models/transactionModel");

const port = process.env.PORT;

app.listen(port, () => {
  console.log(`app is running on localhost:${port}`);
});
mongoose
  .connect(process.env.MONGO_ATLASS_URL)
  .then(() => console.log("connected to db successfully"))
  .catch((err) => console.log(err));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

//STEP 1 getting access token

const getAccessToken = async (req, res, next) => {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  const auth = new Buffer.from(`${key}:${secret}`).toString("base64");

  await axios
    .get(
      "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          authorization: `Basic ${auth}`,
        },
      }
    )
    .then((res) => {
      //   resp.status(200).json(res.data);
      token = res.data.access_token;
      // console.log(token);
      next();
    })
    .catch((err) => {
      console.log(err);
    });
};

//STEP 2 //registerUrl
app.post("/registerUrl", getAccessToken, async (req, res) => {
  
  const shortCode = process.env.MPESA_PAYBILL;
  

  const validation = process.env.VALIDATION_URL;
  const confirmation = process.env.CONFIRMATION_URL;

 

  await axios
    .post(
      "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        ShortCode: shortCode,
        ResponseType: "Completed",
        ConfirmationURL: confirmation ,
        ValidationURL: validation ,
      
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )
    .then((resp) => {
      res.json(resp.data);
      const data = resp.data;
      console.log(resp.data);
    })
    .catch((err) => {
      res.json(err);
      console.log(err.message);
    });
});


//STEP 3 confirmation url
const confirmation = process.env.CONFIRMATION_URL;
app.post(`/confirmation`, (req, res) => {
  if (!req.body.Body.stkCallback.CallbackMetadata) {
    console.log(req.body.Body.stkCallback.ResultDesc);
    res.status(200).json("ok");
    return;
  }

  const amount = req.body.Body.stkCallback.CallbackMetadata.Item[0].Value;
  const code = req.body.Body.stkCallback.CallbackMetadata.Item[1].Value;
  const phone1 =
    req.body.Body.stkCallback.CallbackMetadata.Item[4].Value.toString().substring(
      3
    );
  const phone = `0${phone1}`;
  // saving the transaction to db
  console.log({
    phone,
    code,
    amount,
  });
  const transaction = new Transaction();

  transaction.customer_number = phone;
  transaction.mpesa_ref = code;
  transaction.amount = amount;

  transaction
    .save()
    .then((data) => {
      console.log({ message: "transaction saved successfully", data });
    })
    .catch((err) => console.log(err.message));
    var req_data = {"recipient":transaction.customer_number,"amount":transaction.amount};
    sendAirtime(req_data);
  res.status(200).json("ok");
});

// Step 4 Advanta Airtime Purchase
const sendAirtime =  async (req_data) =>
{
  
  const recipients = [];
  var recipient = req_data;
  recipients.push(recipient);
console.log(recipient)

    let APP_KEY = process.env.APP_KEY;
    let APP_TOKEN = process.env.APP_TOKEN;


  await axios

    .post(
      "https://quicksms.advantasms.com/api/v3/airtime/send",
      {
        recipients: recipients
      },
      {
        headers: {
          'Content-Type' : 'application/json',
          'App-Key': `${APP_KEY}`,
          'App-Token':`${APP_TOKEN}`
        },
      }
    )
    .then((responce) => {
      res.status(200).json(responce.data);
    })
    .catch((err) => {
      console.log(err.message);
      res.status(400).json(err);
    });

}


