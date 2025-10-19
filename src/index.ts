import dotenv from "dotenv";
import logger from "./config/logger";
import app from "./app";

dotenv.config();

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
});

process.on("SIGTERM", () => {
    logger.info("Received SIGTERM signal. Shutting down gracefully...");
    server.close(() => {
        logger.info("Server has been gracefully terminated.");
        process.exit(0);
    });
});

process.on("SIGINT", () => {
    logger.info("Received SIGINT signal. Shutting down gracefully...");
    server.close(() => {
        logger.info("Server has been gracefully terminated.");
        process.exit(0);
    });
});