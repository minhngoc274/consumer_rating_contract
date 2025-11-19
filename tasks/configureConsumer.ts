import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getDomainId } from "./constants";

task("configureConsumer", "Configure RatingConsumer with authorized sender")
  .addParam("consumer", "RatingConsumer contract address")
  .addParam("sender", "RatingSender contract address on source chain")
  .addParam("source", "Source network name (e.g., sepolia, ethereum)")
  .setAction(async (taskArgs: any, hre: HardhatRuntimeEnvironment) => {
    const networkName = hre.network.name;
    console.log(`\nConfiguring RatingConsumer on ${networkName}\n`);

    try {
      const [deployer] = await hre.ethers.getSigners();
      console.log("Configuring with account:", deployer.address);
      console.log();

      // Get source domain ID
      const sourceDomain = getDomainId(taskArgs.source);
      console.log("Source network:", taskArgs.source);
      console.log("Source domain:", sourceDomain);
      console.log("Sender address:", taskArgs.sender);
      console.log();

      // Get RatingConsumer contract
      const ratingConsumer = await hre.ethers.getContractAt("RatingConsumer", taskArgs.consumer);

      // Convert sender address to bytes32
      const senderBytes32 = hre.ethers.zeroPadValue(taskArgs.sender, 32);

      console.log("Setting authorized sender...");
      const tx = await ratingConsumer.setAuthorizedSender(sourceDomain, senderBytes32);
      console.log("Transaction hash:", tx.hash);

      await tx.wait();
      console.log("Transaction confirmed");
      console.log();

      // Verify configuration
      const configuredSender = await ratingConsumer.getAuthorizedSender(sourceDomain);
      console.log("Verification:");
      console.log("   Configured sender:", configuredSender);
      console.log("   Expected sender:", senderBytes32);
      console.log("   Match:", configuredSender === senderBytes32 ? "✓" : "✗");
      console.log();

      console.log("Configuration completed successfully!");

    } catch (error) {
      console.error("\nConfiguration failed:", error);
      throw error;
    }
  });
