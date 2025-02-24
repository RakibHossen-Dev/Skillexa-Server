require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 9000;
app.use(express.json());
app.use(cors());
app.get("/", async (req, res) => {
  res.send("Skillexa server is comming");
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hsnri.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    const blogCollections = client.db("skillexaDb").collection("blogs");
    const userCollections = client.db("skillexaDb").collection("users");
    const coursesCollections = client.db("skillexaDb").collection("Courses");
    const coursesEnrollmentsCollections = client
      .db("skillexaDb")
      .collection("EnrollmentsCourses");

    // jwt

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });
    // middlewares
    const verifyToken = (req, res, next) => {
      console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "forbidden access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "forbidden access" });
        }
        req.decoded = decoded;
        next();
      });
    };
    // payment relate api
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log("amount", amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      console.log("paymentIntent", paymentIntent);
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    // payment relate api

    // ------------------------------------Blog Start-------------------------------------
    // blog get api
    app.get("/blogs", async (req, res) => {
      const result = await blogCollections.find().toArray();
      res.send(result);
    });
    // specific blog get api

    app.get("/blogs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await blogCollections.findOne(query);
      res.send(result);
    });
    // ------------------------------------Blog End-------------------------------------

    // --------------------------------- Users ----------------------------------------
    // user post
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollections.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollections.insertOne(user);
      res.send(result);
    });

    // get all
    app.get("/allUsers", verifyToken, async (req, res) => {
      const result = await userCollections.find().toArray();
      res.send(result);
    });

    // get user role
    app.get("/userRole/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollections.findOne(query);
      res.send(result);
    });

    // CHANGLE ROLE

    app.patch("/changeRole/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: body.role,
        },
      };
      const result = await userCollections.updateOne(query, updateDoc);
      res.send(result);
    });

    // delete user
    app.delete("/deleteUser/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollections.deleteOne(query);
      res.send(result);
    });
    // --------------------------------- Users ----------------------------------------
    // --------------------------------- Course start ----------------------------------------
    app.post("/courses", verifyToken, async (req, res) => {
      const courses = req.body;
      const result = await coursesCollections.insertOne(courses);
      res.send(result);
    });

    app.get("/popularCourses", async (req, res) => {
      const result = await coursesCollections
        .find()
        .sort({ date: -1 })
        .limit(4)
        .toArray();
      res.send(result);
    });
    app.get("/allCourses", async (req, res) => {
      const result = await coursesCollections.find().toArray();
      res.send(result);
    });

    // get specific course
    app.get("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await coursesCollections.findOne(query);
      res.send(result);
    });

    // get specific course for instrutor
    app.get("/instructorCourse/:email", async (req, res) => {
      const email = req.params.email;
      const query = { instructorEmail: email };
      const result = await coursesCollections.find(query).toArray();
      res.send(result);
    });

    app.delete("/instructorCourseDelete/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await coursesCollections.deleteOne(query);
      res.send(result);
    });

    app.patch("/instructorCourseUpdate/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const body = req.body;
      const updateDoc = {
        $set: {
          courseTitle: body.courseTitle,
          price: body.price,
          courseBanner: body.courseBanner,
        },
      };
      const result = await coursesCollections.updateOne(query, updateDoc);
      res.send(result);
    });

    // category ways course
    app.get("/categoryWaysCourses", async (req, res) => {
      const category = req.query.category;
      const result = await coursesCollections.find({ category }).toArray();
      res.send(result);
    });

    // --------------------------------- Course endev ----------------------------------------

    // ------------------------------EnrollmentsCourses start-----------------------
    app.post("/EnrollmentCourses", async (req, res) => {
      const enrollmentCourses = req.body;
      const { enrollStudentEmail, coursesId } = enrollmentCourses;
      const existingEnrollment = await coursesEnrollmentsCollections.findOne({
        enrollStudentEmail: enrollStudentEmail,
        coursesId: coursesId,
      });
      if (existingEnrollment) {
        return res.status(400).send("This course already enrolled");
      }
      const result = await coursesEnrollmentsCollections.insertOne(
        enrollmentCourses
      );
      res.send(result);
    });

    app.get("/myEnrollCourse/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { enrollStudentEmail: email };
      const result = await coursesEnrollmentsCollections.find(query).toArray();
      res.send(result);
    });
    // get specific enroll course
    app.get("/enrollCourses/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await coursesEnrollmentsCollections.findOne(query);
      res.send(result);
    });

    // ------------------------------EnrollmentsCourses end-----------------------

    // instructor all students
    app.get("/instructor/:email/students", verifyToken, (req, res) => {
      const instructorEmail = req.params.email;

      coursesCollections
        .find({ instructorEmail: instructorEmail })
        .toArray()
        .then((courses) => {
          if (courses.length === 0) {
            return res.json({
              message: "No courses found for this instructor.",
            });
          }

          const courseIds = courses.map((course) => course._id.toString());

          coursesEnrollmentsCollections
            .find({ coursesId: { $in: courseIds } })
            .toArray()
            .then((enrollments) => {
              if (enrollments.length === 0) {
                return res.json({
                  message: "No students enrolled in this instructor's courses.",
                });
              }

              const userEmails = enrollments.map(
                (enrollment) => enrollment.enrollStudentEmail
              );

              userCollections
                .find({ email: { $in: userEmails } })
                .toArray()
                .then((students) => {
                  res.json(students);
                });
            });
        });
    });

    //  Instructor Stats API
    app.get("/instructor/:email/stats", verifyToken, (req, res) => {
      const instructorEmail = req.params.email;

      coursesCollections
        .find({ instructorEmail })
        .toArray()
        .then((courses) => {
          const totalCourses = courses.length;
          if (totalCourses === 0) {
            return res.json({
              message: "No courses found for this instructor.",
            });
          }

          const courseIds = courses.map((course) => course._id.toString());

          coursesEnrollmentsCollections
            .find({ coursesId: { $in: courseIds } })
            .toArray()
            .then((enrollments) => {
              const totalStudents = new Set(
                enrollments.map((enrollment) => enrollment.enrollStudentEmail)
              ).size;

              const totalEarnings = enrollments.reduce(
                (sum, enrollment) => sum + parseFloat(enrollment.price),
                0
              );

              res.json({
                instructorEmail,
                totalCourses,
                totalStudents,
                totalEarnings,
              });
            });
        });
    });

    // admin stats
    app.get("/admin/stats", verifyToken, async (req, res) => {
      const totalUsers = await userCollections.countDocuments();
      const instructorsCount = await userCollections.countDocuments({
        role: "instructor",
      });
      const studentsCount = await userCollections.countDocuments({
        role: "student",
      });
      const totalCourses = await coursesCollections.countDocuments();

      // const totalRevenueData = await coursesEnrollmentsCollections
      //   .aggregate([
      //     { $group: { _id: null, totalRevenue: { $sum: "$price" } } },
      //   ])
      //   .toArray();

      // const totalRevenue =
      //   totalRevenueData.length > 0 ? totalRevenueData[0].totalRevenue : 0;
      const totalRevenueData = await coursesEnrollmentsCollections
        .aggregate([
          {
            $match: {
              price: { $ne: null }, // null values বাদ দাও
            },
          },
          {
            $project: {
              price: { $toDouble: "$price" }, // String to Number
            },
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: "$price" },
            },
          },
        ])
        .toArray();

      const totalRevenue =
        totalRevenueData.length > 0 ? totalRevenueData[0].totalRevenue : 0;

      res.send({
        totalUsers,
        instructorsCount,
        studentsCount,
        totalCourses,
        totalRevenue,
      });
    });

    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
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
  console.log(`Skillexa server is running on ${port}`);
});
