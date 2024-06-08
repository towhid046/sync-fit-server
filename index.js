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
    const slideCollection = client.db("syncFitDB").collection("slides");
    const featureCollection = client.db("syncFitDB").collection("features");
    const classCollection = client.db("syncFitDB").collection("classes");
    const reviewCollection = client.db("syncFitDB").collection("reviews");
    const forumCollection = client.db("syncFitDB").collection("forums");
    const newsCollection = client.db("syncFitDB").collection("news");
    const newsLetterUserCollection = client
      .db("syncFitDB")
      .collection("newsLetterUsers");
    const trainerCollection = client.db("syncFitDB").collection("trainers");
    const appliedTrainerCollection = client
      .db("syncFitDB")
      .collection("appliedTrainers");
    const bookedPackageCollection = client
      .db("syncFitDB")
      .collection("bookedPackages");

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

    // get all slices for banner:
    app.get("/slides", async (req, res) => {
      const result = await slideCollection.find().toArray();
      res.send(result);
    });

    // get all users:
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // get a single user role by email:
    app.get("/single-user", async (req, res) => {
      const email = req.query?.email;
      const query = { email };
      const result = await userCollection.findOne(query);
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

    // get all classes:
    app.get("/classes", async (req, res) => {
      const currentPage = Number(req.query?.currentPage);
      const classPerPage = Number(req.query?.totalPerPage);

      const result = await classCollection
        .find()
        .skip((currentPage - 1) * classPerPage)
        .limit(classPerPage)
        .toArray();

      res.send(result);

      // const search = req.query?.search;
      // const query = search
      // ? { service_name: { $regex: search, $options: "i" } }
      //   : {};

      // let result;
      // if (search) {
      //   result = await classCollection.find(query).toArray();
      // } else {
      //   result = await classCollection
      //     .find(query)
      //     .skip((currentPage - 1) * classPerPage)
      //     .limit(classPerPage)
      //     .toArray();
      // }
      // res.send(result);
    });

    // get total classes count:
    app.get("/total-classes-count", async (req, res) => {
      const totalClasses = await classCollection.estimatedDocumentCount();
      res.send({ totalClasses });
    });

    app.post("/add-new-class", async (req, res) => {
      const newClass = req.body;
      const result = await classCollection.insertOne(newClass);
      res.send(result);
    });

    // get all class name:
    app.get("/all-class-name", async (req, res) => {
      const options = { projection: { _id: 0, class_name: 1 } };
      const result = await classCollection.find({}, options).toArray();
      let classNames = [];

      result.forEach((item) => {
        classNames.push({ value: item.class_name, label: item.class_name });
      });
      res.send(classNames);
    });

    // -------------------------------------------------------------------

    // get all reviews:
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    // get all news:
    app.get("/news", async (req, res) => {
      const result = await newsCollection.find().toArray();
      res.send(result);
    });

    // get a single forum by _id:
    app.get("/news/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await newsCollection.findOne(query);
      res.send(result);
    });

    // save a  news letter subscribed user:
    app.post("/news-letter-users/:email", async (req, res) => {
      const newsLetterUser = req.body;
      const query = { email: req.params?.email };
      const isSubScribedUserExist = await newsLetterUserCollection.findOne(
        query
      );

      if (isSubScribedUserExist) {
        return res.send({
          message: "You have already subscribe with this email",
        });
      }
      const result = await newsLetterUserCollection.insertOne(newsLetterUser);
      res.send(result);
    });

    // get all news letter subscribed users:
    app.get("/news-letter-subscribers", async (req, res) => {
      const result = await newsLetterUserCollection.find().toArray();
      res.send(result);
    });

    app.get("/count-news-letter-subscribers", async (req, res) => {
      const result = await newsLetterUserCollection.estimatedDocumentCount();
      res.send({ count: result });
    });

    // ----------------------------------------------------------------
    // get all trainers:
    app.get("/trainers", async (req, res) => {
      const result = await trainerCollection.find().toArray();
      res.send(result);
    });

    // get a single trainer by id :
    app.get("/trainers/:id", async (req, res) => {
      const id = req.params?.id;
      const query = { _id: new ObjectId(id) };
      const result = await trainerCollection.findOne(query);
      res.send(result);
    });

    // get a trainer by email:
    app.get("/trainer-by-email", async (req, res) => {
      const email = req.query?.email;
      const filter = { email };
      const result = await trainerCollection.findOne(filter);
      res.send(result);
    });

    // update a trainer info:
    app.put("/update-trainer", async (req, res) => {
      const email = req.query?.email;
      const query = { email };
      const trainerDoc = req.body;
      const updatedDoc = {
        $set: {
          availableSlots: trainerDoc.availableSlots,
          classes: trainerDoc.classes,
        },
      };
      const result = await trainerCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    // get all slots of a particular trainers by email:
    app.get("/available-slots", async (req, res) => {
      const email = req.query?.email;
      const query = { email: email };
      const options = { projection: { _id: 0, availableSlots: 1 } };
      const result = await trainerCollection.findOne(query, options);
      res.send(result);
    });

    // remove a slot:
    app.delete("/remove-a-slot", async (req, res) => {
      const trainerEmail = req.query?.email;
      const slotName = req.query?.slot_name;
      const filter = { email: trainerEmail };
      const update = { $pull: { availableSlots: slotName } };
      const result = await trainerCollection.updateOne(filter, update);
      res.send(result);
    });
    // -------------------------------

    // remove a trainer and it's role will be changed to Member
    app.delete("/remove-trainer/:id", async (req, res) => {
      const id = req.params?.id;
      const email = req.query.email;
      const query = { _id: new ObjectId(id) };

      const newUserDoc = { email: email, role: "Member" };
      const addedUser = await userCollection.insertOne(newUserDoc);

      let result = "";
      if (addedUser) {
        result = await trainerCollection.deleteOne(query);
      }
      res.send(result);
    });
    // -----------------------------------------------------------
    // save pending trainers api:
    app.post("/applied-trainers", async (req, res) => {
      const email = req.query?.email;
      const query = { email: email };
      const isTrainerExist = await trainerCollection.findOne(query);
      const isAlreadyApplied = await appliedTrainerCollection.findOne(query);
      if (isTrainerExist) {
        return res.send({ message: "trainer_exist" });
      }
      if (isAlreadyApplied) {
        return res.send({ message: "already_applied" });
      }

      const trainer = req.body;
      const result = await appliedTrainerCollection.insertOne(trainer);
      res.send(result);
    });

    // get all applicant
    app.get("/applied-trainers", async (req, res) => {
      const result = await appliedTrainerCollection.find().toArray();
      res.send(result);
    });

    // get a specific applicant
    app.get("/applied-trainers/:id", async (req, res) => {
      const id = req.params?.id;
      const query = { _id: new ObjectId(id) };
      const result = await appliedTrainerCollection.findOne(query);
      res.send(result);
    });

    // accept a applicant as a trainer:
    app.post("/accept-applicant/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      let acceptedApplicant = req.body;
      acceptedApplicant.role = "Trainer";

      delete acceptedApplicant._id;

      const acceptedApplicantDoc = { ...acceptedApplicant };

      const accepted = await trainerCollection.insertOne(acceptedApplicantDoc);
      let result = null;
      if (accepted) {
        result = await appliedTrainerCollection.deleteOne(query);
      }
      res.send(result);
    });

    // ----------------------------------------------------------------
    // save a booked package:
    app.post("/booking-package", async (req, res) => {
      const bookedPackage = req.body;
      const result = await bookedPackageCollection.insertOne(bookedPackage);
      res.send(result);
    });

    // get all booking-packages:
    app.get("/all-booked-packages", async (req, res) => {
      const result = await bookedPackageCollection.find().toArray();
      res.send(result);
    });

    // --------------------------------------------------------------

    // post a forums:
    app.post("/forums", async (req, res) => {
      const forum = req.body;
      const result = await forumCollection.insertOne(forum);
      res.send(result);
    });

    // get total forums count:
    app.get("/total-forums-count", async (req, res) => {
      const totalForums = await forumCollection.estimatedDocumentCount();
      res.send({ totalForums });
    });

    // get all forums:
    app.get("/forums", async (req, res) => {
      const currentPage = Number(req.query?.currentPage);
      const forumPerPage = Number(req.query?.totalPerPage);
      const result = await forumCollection
        .find()
        .skip((currentPage - 1) * forumPerPage)
        .limit(forumPerPage)
        .toArray();

      res.send(result);
    });

    // modify the forms up and down vote by using patch method:
    app.patch("/modify-forum-up-vote", async (req, res) => {
      const id = req.query?.id;
      const voteState = req.query?.voteState === "true" ? true : false;
      const downVote = req.query?.downVote;

      const query = { _id: new ObjectId(id) };
      const options = {
        projection: { _id: 0, up_vote_count: 1 },
      };
      const targetedForum = await forumCollection.findOne(query, options);
      const currentUpVoteCount = Number(targetedForum.up_vote_count);

      let setDoc = {};
      if (downVote === "down" && !voteState) {
        setDoc = { up_vote_count: currentUpVoteCount - 1 };
      }

      if (voteState && downVote !== "down") {
        setDoc = { up_vote_count: currentUpVoteCount + 1 };
      }

      if (downVote !== "down" && voteState === false) {
        setDoc = { up_vote_count: currentUpVoteCount - 1 };
      }

      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: setDoc,
      };
      const result = await forumCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // --------------------------------------------------------

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
