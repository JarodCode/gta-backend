/**
 * API Routes
 * 
 * This file defines all API routes for the application.
 * Routes are organized by resource and HTTP method.
 */

import { Router } from "https://deno.land/x/oak@v12.5.0/mod.ts";
import userController from "../controllers/user-controller.ts";
import gameController from "../controllers/game-controller.ts";
import { authMiddleware, optionalAuthMiddleware } from "../utils/auth.ts";
import { validateRequest } from "../utils/validation.ts";
import { 
  userRegistrationSchema, 
  userLoginSchema,
  reviewCreationSchema,
  reviewUpdateSchema,
  gameIdParamSchema,
  reviewIdParamSchema
} from "../utils/validation.ts";

// Create router
const router = new Router();

// Health check route
router.get("/health", (ctx) => {
  ctx.response.body = { status: "ok", timestamp: new Date().toISOString() };
});

// User routes
router.post("/users/register", validateRequest(userRegistrationSchema), userController.register.bind(userController));
router.post("/users/login", validateRequest(userLoginSchema), userController.login.bind(userController));
router.post("/users/logout", userController.logout.bind(userController));
router.get("/users/me", authMiddleware, userController.getCurrentUser.bind(userController));
router.patch("/users/me", authMiddleware, userController.updateCurrentUser.bind(userController));
router.get("/users/:id", userController.getUserById.bind(userController));
router.get("/users", authMiddleware, userController.getAllUsers.bind(userController));

// Game routes
router.get("/games/search", gameController.searchGames.bind(gameController));
router.get("/games/popular", gameController.getPopularGames.bind(gameController));
router.get("/games/recent", gameController.getRecentGames.bind(gameController));
router.get("/games/:id", validateRequest(gameIdParamSchema, "params"), gameController.getGameById.bind(gameController));
router.get("/games/:gameId/reviews", validateRequest(gameIdParamSchema, "params"), gameController.getGameReviews.bind(gameController));
router.post("/games/:gameId/reviews", authMiddleware, validateRequest(gameIdParamSchema, "params"), validateRequest(reviewCreationSchema), gameController.createOrUpdateReview.bind(gameController));
router.delete("/reviews/:reviewId", authMiddleware, validateRequest(reviewIdParamSchema, "params"), gameController.deleteReview.bind(gameController));

// User reviews routes
router.get("/users/:userId/reviews", gameController.getUserReviews.bind(gameController));
router.get("/users/me/reviews", authMiddleware, gameController.getUserReviews.bind(gameController));

// Export router
export default router; 