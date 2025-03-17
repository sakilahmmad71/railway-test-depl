import { Router } from "express";
import {
    refreshToken,
    signIn,
    signOut,
    signUp,
} from "../controllers/auth.controller.js";
import authorize from "../middlewares/auth.middleware.js";

const authRouter = Router();

// /api/v1/auth/signup
authRouter.post("/signup", signUp);

// /api/v1/auth/signin
authRouter.post("/signin", signIn);

// /api/v1/auth/refresh-token
authRouter.post("/refresh-token", refreshToken);

// /api/v1/auth/signout - requires authentication
authRouter.post("/signout", authorize, signOut);

export default authRouter;
