import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getDomainId } from "./constants";

task("configureSender", "Configure RatingSender with destination recipient")
  .addParam("sender", "RatingSender contract address")
  .addParam("consumer", "RatingConsumer contract address on destination chain")
  .addParam("destination", "Destination network name (e.g., arbitrumSepolia, arbitrum)")
  .setAction(async (taskArgs: any, hre: HardhatRuntimeEnvironment) => {
    const networkName = hre.network.name;
    console.log(`\nConfiguring RatingSender on ${networkName}\n`);

    try {
      const [deployer] = await hre.ethers.getSigners();
      console.log("Configuring with account:", deployer.address);
      console.log();

      // Get destination domain ID
      const destinationDomain = getDomainId(taskArgs.destination);
      console.log("Destination network:", taskArgs.destination);
      console.log("Destination domain:", destinationDomain);
      console.log("Consumer address:", taskArgs.consumer);
      console.log();

      // Get RatingSender contract
      const ratingSender = await hre.ethers.getContractAt("RatingSender", taskArgs.sender);

      // Convert consumer address to bytes32
      const consumerBytes32 = hre.ethers.zeroPadValue(taskArgs.consumer, 32);

      console.log("Setting destination recipient...");
      const tx = await ratingSender.setDestinationRecipient(destinationDomain, consumerBytes32);
      console.log("Transaction hash:", tx.hash);

      await tx.wait();
      console.log("Transaction confirmed");
      console.log();

      // Verify configuration
      const configuredRecipient = await ratingSender.getDestinationRecipient(destinationDomain);
      console.log("Verification:");
      console.log("   Configured recipient:", configuredRecipient);
      console.log("   Expected recipient:", consumerBytes32);
      console.log("   Match:", configuredRecipient === consumerBytes32 ? "✓" : "✗");
      console.log();

      console.log("Configuration completed successfully!");

    } catch (error) {
      console.error("\nConfiguration failed:", error);
      throw error;
    }
  });
