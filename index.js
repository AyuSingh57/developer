//server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const app = express();
app.use(express.json());
app.use(cors());
app.use("/uploads", express.static("uploads"));
mongoose.connect("mongodb://127.0.0.1:27017/socialnotes")
.then(()=>console.log("MongoDB connected"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/notes", require("./routes/notes"));
app.use("/api/follow", require("./routes/follow"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/ai", require("./routes/ai"));
const server = http.createServer(app);
const io = new Server(server,{
cors:{origin:"*"}
});
io.on("connection",(socket)=>{
console.log("User connected");
socket.on("sendMessage",(data)=>{
io.emit("receiveMessage",data);
});
socket.on("disconnect",()=>{
console.log("User disconnected");
});
});
server.listen(5000,()=>console.log("Server running on port 5000"));

//user.js
const mongoose = require("mongoose");
const userSchema = new mongoose.Schema({
username:String,
email:String,
password:String,
role:{type:String,default:"user"},
banned:{type:Boolean,default:false},
verified:{type:Boolean,default:false},
darkMode:{type:Boolean,default:false},
followers:[{type:mongoose.Schema.Types.ObjectId,ref:"User"}],
following:[{type:mongoose.Schema.Types.ObjectId,ref:"User"}]
});
module.exports = mongoose.model("User",userSchema);

//note.js
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const app = express();
app.use(cors());
app.use(express.json());
mongoose.connect("mongodb://127.0.0.1:27017/notesapp");
const noteSchema = new mongoose.Schema({
title:String,
fileUrl:String,
user:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
likes:[{type:mongoose.Schema.Types.ObjectId,ref:"User"}],
savedBy:[{type:mongoose.Schema.Types.ObjectId,ref:"User"}]
});
const Note = mongoose.model("Note",noteSchema);
const storage = multer.diskStorage({
destination:function(req,file,cb){
cb(null,"uploads/");
},
filename:function(req,file,cb){
cb(null,Date.now()+path.extname(file.originalname));
}
});
const upload = multer({storage:storage});
app.use("/uploads",express.static("uploads"));
app.post("/notes",upload.single("image"),async(req,res)=>{
try{
const newNote = new Note({
title:req.body.title,
fileUrl:req.file?"/uploads/"+req.file.filename:"",
user:req.body.user
});
await newNote.save();
res.json(newNote);
}catch(error){
res.status(500).json({message:error.message});
}
});
app.get("/notes",async(req,res)=>{
const notes = await Note.find().populate("user");
res.json(notes);
});
app.listen(5000,()=>{
console.log("Server running on port 5000");
});

//comment.js
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const app = express();
app.use(cors());
app.use(express.json());
mongoose.connect("mongodb://127.0.0.1:27017/notesapp");

// NOTE SCHEMA
const noteSchema = new mongoose.Schema({
title:String,
fileUrl:String,
user:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
likes:[{type:mongoose.Schema.Types.ObjectId,ref:"User"}],
savedBy:[{type:mongoose.Schema.Types.ObjectId,ref:"User"}]
},{timestamps:true});

// COMMENT SCHEMA
const commentSchema = new mongoose.Schema({
text:String,
image:String,
user:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
note:{type:mongoose.Schema.Types.ObjectId,ref:"Note"},
likes:[{type:mongoose.Schema.Types.ObjectId,ref:"User"}]
},{timestamps:true});
const Note = mongoose.model("Note",noteSchema);
const Comment = mongoose.model("Comment",commentSchema);

// MULTER
const storage = multer.diskStorage({
destination:function(req,file,cb){
cb(null,"uploads/");
},
filename:function(req,file,cb){
cb(null,Date.now()+path.extname(file.originalname));
}
});
const upload = multer({storage:storage});

// STATIC
app.use("/uploads",express.static("uploads"));

// CREATE NOTE
app.post("/notes",upload.single("image"),async(req,res)=>{
try{

const newNote = new Note({
title:req.body.title,
fileUrl:req.file?"/uploads/"+req.file.filename:"",
user:req.body.user
});

await newNote.save();

res.json(newNote);

}catch(error){
res.status(500).json({message:error.message});
}
});

// GET NOTES WITH COMMENT COUNT
app.get("/notes",async(req,res)=>{
const notes = await Note.find().populate("user");
const notesWithComments = await Promise.all(
notes.map(async(note)=>{
const count = await Comment.countDocuments({note:note._id});
return {...note._doc,commentCount:count};
})
);
res.json(notesWithComments);
});

// ADD COMMENT (WITH IMAGE)
app.post("/comments",upload.single("image"),async(req,res)=>{
try{
const comment = new Comment({
text:req.body.text,
image:req.file?"/uploads/"+req.file.filename:"",
user:req.body.user,
note:req.body.note
});
await comment.save();
res.json(comment);
}catch(err){
res.status(500).json(err);
}
});

// GET COMMENTS
app.get("/comments/:noteId",async(req,res)=>{
try{
const comments = await Comment.find({note:req.params.noteId})
.populate("user")
.sort({createdAt:-1});
res.json(comments);
}catch(err){
res.status(500).json(err);
}
});

// LIKE COMMENT
app.post("/comments/like/:id",async(req,res)=>{
try{
const comment = await Comment.findById(req.params.id);
if(!comment.likes.includes(req.body.user)){
comment.likes.push(req.body.user);
}else{
comment.likes.pull(req.body.user);
}
await comment.save();
res.json(comment);
}catch(err){
res.status(500).json(err);
}
});
app.listen(5000,()=>{
console.log("Server running on port 5000");
});

//notification.js
const mongoose = require("mongoose");
const notificationSchema = new mongoose.Schema({
user:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
sender:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
type:String,
note:{type:mongoose.Schema.Types.ObjectId,ref:"Note"},
createdAt:{type:Date,default:Date.now}
});
module.exports = mongoose.model("Notification",notificationSchema);

//authMiddleware.js
const jwt = require("jsonwebtoken");
module.exports=(req,res,next)=>{
const token=req.header("Authorization");
if(!token) return res.status(401).json({msg:"No token"});
try{
const decoded=jwt.verify(token,"secretkey");
req.user=decoded;
next();
}
catch{
res.status(400).json({msg:"Invalid token"});
}
};

//adminMiddleware.js
const User=require("../models/User");
module.exports=async(req,res,next)=>{
const user=await User.findById(req.user.id);
if(user.role!=="admin"){
return res.status(403).json({msg:"Admin only"});
}
next();
};

//auth.jds
const router=require("express").Router();
const User=require("../models/User");
const bcrypt=require("bcryptjs");
const jwt=require("jsonwebtoken");
const auth=require("../middleware/authMiddleware");
router.post("/register",async(req,res)=>{
const {username,email,password}=req.body;
const hashed=await bcrypt.hash(password,10);
const user=await User.create({
username,email,password:hashed
});
res.json(user);
});
router.post("/login",async(req,res)=>{
const {email,password}=req.body;
const user=await User.findOne({email});
if(!user) return res.status(400).json({msg:"User not found"});
const valid=await bcrypt.compare(password,user.password);
if(!valid) return res.status(400).json({msg:"Invalid credentials"});
const token=jwt.sign({id:user._id},"secretkey");
res.json({token});
});
router.get("/search/:name",async(req,res)=>{
const users=await User.find({
username:{$regex:req.params.name,$options:"i"}
}).select("username");
res.json(users);
});
router.post("/darkmode",auth,async(req,res)=>{
const user=await User.findById(req.user.id);
user.darkMode=!user.darkMode;
await user.save();
res.json({darkMode:user.darkMode});
});
module.exports=router;

//follow.js
const router=require("express").Router();
const User=require("../models/User");
const Notification=require("../models/Notification");
const auth=require("../middleware/authMiddleware");
router.post("/:id",auth,async(req,res)=>{
const userToFollow=await User.findById(req.params.id);
const currentUser=await User.findById(req.user.id);
currentUser.following.push(userToFollow._id);
userToFollow.followers.push(currentUser._id);
await Notification.create({
user:userToFollow._id,
sender:currentUser._id,
type:"follow"
});
await currentUser.save();
await userToFollow.save();
res.json({msg:"Followed"});
});
module.exports=router;

//notifications.js
const router=require("express").Router();
const Notification=require("../models/Notification");
const auth=require("../middleware/authMiddleware");
router.get("/",auth,async(req,res)=>{
const notifications=await Notification.find({user:req.user.id})
.populate("sender","username")
.populate("note");
res.json(notifications);
});
module.exports=router;

//admin.js
const router=require("express").Router();
const User=require("../models/User");
const Note=require("../models/Note");
const auth=require("../middleware/authMiddleware");
const admin=require("../middleware/adminMiddleware");
router.get("/users",auth,admin,async(req,res)=>{
const users=await User.find().select("-password");
res.json(users);
});
router.get("/notes",auth,admin,async(req,res)=>{
const notes=await Note.find().populate("user","username");
res.json(notes);
});
router.delete("/note/:id",auth,admin,async(req,res)=>{
await Note.findByIdAndDelete(req.params.id);
res.json({msg:"Note deleted"});
});
router.post("/ban/:id",auth,admin,async(req,res)=>{
const user=await User.findById(req.params.id);
user.banned=true;
await user.save();
res.json({msg:"User banned"});
});
router.post("/verify/:id",auth,admin,async(req,res)=>{
const user=await User.findById(req.params.id);
user.verified=true;
await user.save();
res.json({msg:"User verified"});
});
router.get("/stats",auth,admin,async(req,res)=>{
const users=await User.countDocuments();
const notes=await Note.countDocuments();
res.json({
totalUsers:users,
totalNotes:notes
});
});
module.exports=router;

//ai.js
const router=require("express").Router();
const generateNotes=require("../utils/aiGenerator");
router.post("/generate",async(req,res)=>{
const {topic}=req.body;
const notes=await generateNotes(topic);
res.json({notes});
});
module.exports=router;

//aiGenerator.js
const OpenAI = require("openai");
require('dotenv').config(); // Taaki tumhari API key secure rahe
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY // Apni key .env file mein rakhein
});
async function generateNotes(topic) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Tum ek intelligent study assistant ho. 
                    Tumhe **Ayush Singh** ne banaya hai, jo **SRMU (Shri Ramswaroop Memorial University)** mein padhte hain. 
                    Agar koi tumse tumhare creator ke baare mein puche, toh hamesha ye details dena:
                    1. Creator: Ayush Singh.
                    2. Instagram: @i_ayush_singh_official.
                    3. Education: Ayush SRMU mein student hain.                 
                    Hamesha helpful raho aur notes ko clear points mein likho.`
                },
                {
                    role: "user",
                    content: topic
                }
            ],
            temperature: 0.7
        });
        return response.choices[0].message.content;
    } catch (error) {
        console.error("Error occurred:", error.message);
        return "Sorry, abhi main notes generate nahi kar pa raha hoon.";
    }
}
module.exports = generateNotes;