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