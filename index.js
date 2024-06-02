const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();

const port = process.env.PORT || 5000;

// middleware:
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Assignment 12 server is running");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.q1nysvk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const userCollection = client.db("syncFitDB").collection("users");
    const featureCollection = client.db("syncFitDB").collection("features");
    const classCollection = client.db("syncFitDB").collection("classes");
    const reviewCollection = client.db("syncFitDB").collection("reviews");
    const forumCollection = client.db("syncFitDB").collection("forums");

    // save user to bd:
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const isUserExist = await userCollection.findOne(query);
      if (isUserExist) {
        return;
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // get all users:
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // get all features:
    app.get("/features", async (req, res) => {
      const result = await featureCollection.find().toArray();
      res.send(result);
    });

    // get the popular 6 classes based on the totalBookings:
    app.get("/popular-classes", async (req, res) => {
      const result = await classCollection
        .find()
        .sort({ totalBookings: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // get all reviews:
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    // get all forums:
    app.get("/forums", async (req, res) => {
      const result = await forumCollection.find().toArray();
      res.send(result);
    });

    // get a single forum by _id:
    app.get("/forums/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await forumCollection.findOne(query);
      res.send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Assignment-12 is running on PORT: ${port}`);
});
