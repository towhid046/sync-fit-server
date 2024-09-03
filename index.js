const express = require("express");
const cors = require("cors");
const { verify, sign } = require("jsonwebtoken");
require("dotenv").config();
const nodemailer = require("nodemailer");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const stripe = require("stripe")(process.env.STRIPE_PRIVATE_KEY);
const app = express();

const port = process.env.PORT || 5000;

// middleware:
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:4173",
      "https://sync-fit2.web.app",
      "https://sync-fit2.firebaseapp.com",
    ],
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.send("SyncFit server is running");
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
// email sender transport:
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
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

    // -----------------------------------
    // email sending api:
    app.post("/send-email", async (req, res) => {
      const { email } = req.body;
      if (!email) {
        return res.status(400).send({ message: "User email is required" });
      }

      const {
        trainerName,
        trainerEmail,
        slotName,
        packageName,
        price,
        userName,
        userEmail,
        paymentStatus,
      } = await bookedPackageCollection.findOne({
        userEmail: email,
        paymentStatus: "paid",
      });
      if (!trainerName) {
        return res.status(400).send({ message: "User not is found" });
      }
      const { image: trainerImage } = await trainerCollection.findOne(
        { email: trainerEmail },
        { projection: { _id: 0, image: 1 } }
      );
      const syncFitEmail = "syncfit2@gmail.com";
      const syncFitPhone = "+880123456877";
      const syncFitWebsite = "https://sync-fit2.web.app";
      const emailContent = `
           <section style="font-family: Arial, sans-serif; background-color: #f0f4f8; padding: 50px 20px; color: #333;">
             <div style="max-width: 600px; margin: auto; background-color: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
               <h2 style="text-align: center; color: #1d4ed8;">Thank You for Booking with SyncFit!</h2>
               <p style="font-size: 16px; color: #555;">Hi ${userName},</p>
               <p style="font-size: 16px; color: #555;">Thank you for booking a <strong>${packageName}</strong> with us. We are thrilled to have you on board and look forward to helping you achieve your fitness goals. And <strong>${trainerName}</strong> will be your trainer.</p>

               <div style="display: flex; justify-content:center;  margin: 20px auto; ">
                 <img src=${trainerImage} alt="${trainerName}" style="border-radius: 50%; width: 100px; height: 100px;  margin:auto;">
               </div>

               <p style="font-size: 16px; color: #555;">Booking Details:</p>
               <ul style="font-size: 16px; color: #555; padding-left: 20px;">
                 <li><strong>Service:</strong> ${packageName}</li>
                 <li><strong>Price:</strong> $${price}</li>
                 <li><strong>Trainer:</strong> ${trainerName}</li>
                 <li><strong>Date and Time:</strong> ${slotName}</li>
                 <li><strong>Payment Status:</strong> ${paymentStatus}</li>
               </ul>

               <p style="font-size: 16px; color: #555;">If you have any questions or need to reschedule, please feel free to contact us at <a href="mailto:${syncFitEmail}" style="color: #1d4ed8;">${syncFitEmail}</a> or call us at <a href="tel:${syncFitPhone}" style="color: #1d4ed8;">${syncFitPhone}</a>.</p>

               <p style="font-size: 16px; color: #555;">We look forward to seeing you soon!</p>

               <p style="font-size: 16px; color: #555;">Best regards,</p>
               <p style="font-size: 16px; color: #555;"><strong>The SyncFit Team</strong></p>

               <div style="text-align: center; margin-top: 20px;">
                 <a href="${syncFitWebsite}" style="display: inline-block; padding: 10px 20px; background-color: #1d4ed8; color: #fff; text-decoration: none; border-radius: 5px;">Visit SyncFit</a>
               </div>
             </div>
           </section>
          `;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: "SyncFit Payment",
        html: emailContent,
      };

      try {
        await transporter.sendMail(mailOptions);
        res.status(200).send({ message: "Email sent success" });
      } catch (error) {
        res.status(500).send({ message: error });
      }
    });
    // -----------------------------------
    // Payment related apis
    app.post("/make-payment", async (req, res) => {
      const trainer = req.body;
      let price = 0;
      if (trainer.packageName === "Basic Membership") {
        price = 10;
      }
      if (trainer.packageName === "Standard Membership") {
        price = 50;
      }
      if (trainer.packageName === "Premium Membership") {
        price = 100;
      }

      if (!price) {
        return res.status(500).send({ message: "Something went wrong!" });
      }

      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "payment",
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: `${trainer.trainerName} will be your trainer`,
                },
                unit_amount: price * 100,
              },
              quantity: 1,
            },
          ],
          success_url: `${process.env.CLIENT_URL}/success-payment`,
          cancel_url: `${process.env.CLIENT_URL}/cancel-payment`,
        });
        res.send({ url: session.url });
      } catch (e) {
        res.status(500).send(e.message);
      }
    });

    // update the payment status:
    app.patch("/update-booking-package-payment-status", async (req, res) => {
      const userEmail = req.body?.email;
      if (!userEmail) {
        return;
      }
      const query = { userEmail };
      const updateDoc = {
        $set: { paymentStatus: "paid" },
      };
      const result = await bookedPackageCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // delete the booked package that cancel the payment:
    app.delete("/delete-booking-package-payment-cancel", async (req, res) => {
      const userEmail = req.query?.email;
      if (!userEmail) {
        return;
      }
      const query = { userEmail, paymentStatus: "unpaid" };
      const result = await bookedPackageCollection.deleteOne(query);
      res.send(result);
    });
    // -----------------------------------

    // custom middleware:
    // verifyToken:
    const verifyToken = (req, res, next) => {
      if (!req.headers?.authorization) {
        return res.status(401).send({ message: "unauthorize access" });
      }
      const token = req.headers?.authorization.split(" ")[1];
      if (!token) {
        return res.status(401).send({ message: "unauthorize access" });
      }
      verify(token, process.env.TOKEN_SECRET_KEY, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: "forbidden access" });
        }
        req.user = decoded;
        next();
      });
    };

    // verifyAdmin:
    const verifyAdmin = async (req, res, next) => {
      const email = req.user?.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "Admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // verifyTrainer:
    const verifyTrainer = async (req, res, next) => {
      const email = req.user?.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let isTrainer = user?.role === "Trainer";
      if (!isTrainer) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    app.get("/user-role/:email", async (req, res) => {
      const email = req.params?.email;
      const query = { email };
      const options = { projection: { _id: 0, role: 1 } };
      const user_role = await userCollection.findOne(query, options);
      res.send(user_role);
    });

    // token verification related api:
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = sign(user, process.env.TOKEN_SECRET_KEY, {
        expiresIn: "2h",
      });
      res.send({ token });
    });

    // ----------------------------------

    // save user to bd:
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const isUserExist = await userCollection.findOne(query);
      if (isUserExist?.email) {
        res.send({ message: "user already exist" });
      }
      const result = await userCollection.insertOne(user);
      if (result.insertedId) {
        res.send(result);
      }
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

      const search = req.query?.search?.trim();
      const query = search
        ? { class_name: { $regex: search, $options: "i" } }
        : {};

      let result;
      if (search) {
        result = await classCollection.find(query).toArray();
      } else {
        result = await classCollection
          .find(query)
          .skip((currentPage - 1) * classPerPage)
          .limit(classPerPage)
          .toArray();
      }
      res.send(result);
    });

    // get total classes count:
    app.get("/total-classes-count", async (req, res) => {
      const totalClasses = await classCollection.estimatedDocumentCount();
      res.send({ totalClasses });
    });

    app.post("/add-new-class", verifyToken, verifyAdmin, async (req, res) => {
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

    // get 5 trainers by the matched class name
    app.get("/get-class-instructors", async (req, res) => {
      const { className } = req.query;

      if (!className) {
        return res.status(400).send({ message: "Class Name is required" });
      }

      const filter = {
        classes: className,
      };
      const projection = {
        _id: 1,
        name: 1,
        image: 1,
      };

      try {
        const result = await trainerCollection
          .find(filter)
          .project(projection)
          .limit(5)
          .toArray();

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });
    // -------------------------------------------------------------------
    // save a review:
    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    // get all reviews:
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });
    // ----------------------------------------------------------------

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
    app.get(
      "/news-letter-subscribers",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const result = await newsLetterUserCollection.find().toArray();
        res.send(result);
      }
    );

    app.get(
      "/count-news-letter-subscribers",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const result = await newsLetterUserCollection.estimatedDocumentCount();
        res.send({ count: result });
      }
    );

    // ----------------------------------------------------------------
    // get all trainers:
    app.get("/trainers", async (req, res) => {
      const result = await trainerCollection.find().toArray();
      res.send(result);
    });

    // get 5 trainers based on specific className:
    app.get("/class-related-trainers", async (req, res) => {
      const className = req.query?.className;
      const query = { classes: className };
      const options = { projection: { name: 1, image: 1 } };
      const result = await trainerCollection
        .find(query, options)
        .limit(5)
        .toArray();
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
    app.get(
      "/available-slots",
      verifyToken,
      verifyTrainer,
      async (req, res) => {
        const email = req.query?.email;
        const query = { email: email };
        const options = { projection: { _id: 0, availableSlots: 1 } };
        const result = await trainerCollection.findOne(query, options);
        res.send(result);
      }
    );

    // remove a slot:
    app.delete(
      "/remove-a-slot",
      verifyToken,
      verifyTrainer,
      async (req, res) => {
        const trainerEmail = req.query?.email;
        const slotName = req.query?.slot_name;
        const filter = { email: trainerEmail };
        const update = { $pull: { availableSlots: slotName } };
        const result = await trainerCollection.updateOne(filter, update);
        res.send(result);
      }
    );
    // -------------------------------

    // remove a trainer and it's role will be changed to Member
    app.delete(
      "/remove-trainer/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params?.id;
        const query = { _id: new ObjectId(id) };
        const result = await trainerCollection.deleteOne(query);
        res.send(result);
      }
    );
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
    app.get("/applied-trainers", verifyToken, verifyAdmin, async (req, res) => {
      const query = { status: "Pending" };
      const result = await appliedTrainerCollection.find(query).toArray();
      res.send(result);
    });

    // get a specific applicant
    app.get("/applied-trainers/:id", async (req, res) => {
      const id = req.params?.id;
      const query = { _id: new ObjectId(id) };
      const result = await appliedTrainerCollection.findOne(query);
      res.send(result);
    });

    // get a applied trainer by email:
    app.get("/applied-trainer-by-email", async (req, res) => {
      const email = req.query?.email;
      const query = { email };
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

      const filter = { email: acceptedApplicant?.email };
      const userDoc = {
        $set: {
          email: acceptedApplicant?.email,
          role: "Trainer",
          status: "Accepted",
        },
      };
      const acceptedTrainer = await userCollection.updateOne(filter, userDoc);

      let result = null;
      if (accepted && acceptedTrainer) {
        result = await appliedTrainerCollection.deleteOne(query);
      }
      res.send(result);
    });

    // update a rejected applicant with status and feedback:
    app.patch("/rejected-applicant", async (req, res) => {
      const email = req.query?.email;
      const rejectedApplicant = req.body;

      const filter = { email };
      const updatedDoc = {
        $set: {
          status: "Rejected",
          adminFeedback: rejectedApplicant?.feedback,
        },
      };
      const result = await appliedTrainerCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(result);
    });

    // ----------------------------------------------------------------
    // save a booked package:
    app.post("/booking-package", async (req, res) => {
      const bookedPackage = req.body;
      const result = await bookedPackageCollection.insertOne({
        ...bookedPackage,
        paymentStatus: "unpaid",
      });
      res.send(result);
    });

    // get a booked trainer by user email:
    app.get("/booked-package-by-email", async (req, res) => {
      const email = req.query?.email;
      const query = { userEmail: email };
      const result = await bookedPackageCollection.findOne(query);
      res.send(result);
    });

    // get all booking-packages:
    app.get(
      "/all-booked-packages",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const result = await bookedPackageCollection
          .find({ paymentStatus: "paid" })
          .toArray();
        res.send(result);
      }
    );

    // --------------------------------------------------------------

    // post a forums:
    app.post("/forums", verifyToken, async (req, res) => {
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