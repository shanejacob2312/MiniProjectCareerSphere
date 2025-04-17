const mongoose = require("mongoose");
const bcryptjs = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password in queries by default
  },
  resetPasswordToken: {
    type: String,
    select: false
  },
  resetPasswordExpires: {
    type: Date,
    select: false
  },
  lastLogin: {
    type: Date
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  accountLocked: {
    type: Boolean,
    default: false
  },
  accountLockExpires: {
    type: Date
  },
  active: {
    type: Boolean,
    default: true,
    select: false
  }
}, { 
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.resetPasswordToken;
      delete ret.resetPasswordExpires;
      delete ret.failedLoginAttempts;
      delete ret.accountLocked;
      delete ret.accountLockExpires;
      return ret;
    }
  }
});

// Index for performance
UserSchema.index({ email: 1 });
UserSchema.index({ resetPasswordToken: 1 }, { sparse: true });

// Password validation middleware (runs before save)
UserSchema.pre('validate', function(next) {
  // Only validate password if it's being modified
  if (this.isModified('password')) {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
    if (!passwordRegex.test(this.password)) {
      this.invalidate('password', 'Password must contain at least 8 characters, including uppercase, lowercase, numbers and special characters');
    }
  }
  next();
});

// Update password and reset attempts
UserSchema.methods.updatePassword = async function(newPassword) {
  // Validate password before updating
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    throw new Error('Password must contain at least 8 characters, including uppercase, lowercase, numbers and special characters');
  }
  
  this.password = newPassword;
  this.failedLoginAttempts = 0;
  this.accountLocked = false;
  this.accountLockExpires = undefined;
  await this.save();
};

// Increment failed login attempts
UserSchema.methods.incrementLoginAttempts = async function() {
  this.failedLoginAttempts += 1;
  
  if (this.failedLoginAttempts >= 5) {
    this.accountLocked = true;
    this.accountLockExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  }
  
  await this.save();
};

// Reset failed login attempts
UserSchema.methods.resetLoginAttempts = async function() {
  this.failedLoginAttempts = 0;
  this.accountLocked = false;
  this.accountLockExpires = undefined;
  this.lastLogin = new Date();
  await this.save();
};

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcryptjs.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

// Hash password before saving (runs after validation)
UserSchema.pre("save", async function(next) {
  try {
    if (!this.isModified("password")) return next();
    
    const salt = await bcryptjs.genSalt(12);
    this.password = await bcryptjs.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Ensure email is lowercase before saving
UserSchema.pre("save", function(next) {
  if (this.isModified("email")) {
    this.email = this.email.toLowerCase();
  }
  next();
});

module.exports = mongoose.model("User", UserSchema);
