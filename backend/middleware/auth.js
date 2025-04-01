const jwt = require("jsonwebtoken");
const User = require("../models/user");
require("dotenv").config();

const auth = async (req, res, next) => {
    try {
        // Get token from header or cookie
        const token = req.header("Authorization")?.replace("Bearer ", "") || 
                     req.cookies?.token;

        if (!token) {
            return res.status(401).json({ 
                message: "Authentication required. Please log in." 
            });
        }

        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET, {
                algorithms: ['HS256']
            });

            // Get user and check if still exists/active
            const user = await User.findOne({ 
                _id: decoded.userId,
                active: true
            }).select('+accountLocked +accountLockExpires');

            if (!user) {
                return res.status(401).json({ 
                    message: "User no longer exists or is inactive" 
                });
            }

            // Check if account is locked
            if (user.accountLocked && user.accountLockExpires > Date.now()) {
                return res.status(401).json({
                    message: "Account is temporarily locked. Please try again later."
                });
            }

            // Clear lock if expired
            if (user.accountLocked && user.accountLockExpires <= Date.now()) {
                user.accountLocked = false;
                user.accountLockExpires = undefined;
                user.failedLoginAttempts = 0;
                await user.save();
            }

            // Attach user to request
            req.user = {
                id: user._id,
                email: user.email,
                name: user.name
            };
            req.token = token;

            next();
        } catch (error) {
            if (error.name === "TokenExpiredError") {
                return res.status(401).json({ 
                    message: "Session expired. Please log in again." 
                });
            } else if (error.name === "JsonWebTokenError") {
                return res.status(401).json({ 
                    message: "Invalid authentication token" 
                });
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error("Auth Middleware Error:", error);
        res.status(500).json({ 
            message: "Internal server error during authentication" 
        });
    }
};

module.exports = auth;
