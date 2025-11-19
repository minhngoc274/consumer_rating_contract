import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { deployContractWithProxy, logDeploymentSummary } from "./utils";
import { getChainConfig, getMailboxAddress } from "./constants";

task("deployRatingConsumer", "Deploy or upgrade RatingConsumer contract")
  .addOptionalParam("mailbox", "Hyperlane Mailbox address (if not provided, uses default for network)")
  .addOptionalParam("verify", "Verify contract on block explorer", "false")
  .setAction(async (taskArgs: any, hre: HardhatRuntimeEnvironment) => {
    const networkName = hre.network.name;
    console.log(`\nDeploying/Upgrading RatingConsumer on ${networkName}\n`);

    try {
      const [deployer] = await hre.ethers.getSigners();
      console.log("Deploying with account:", deployer.address);
      const balance = await hre.ethers.provider.getBalance(deployer.address);
      console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");
      console.log();

      // Get chain config
      const chainConfig = getChainConfig(networkName);
      console.log("Chain ID:", chainConfig.chainId);
      console.log("Domain ID:", chainConfig.domainId);

      // Determine Mailbox address
      let mailboxAddress = taskArgs.mailbox;
      if (!mailboxAddress) {
        try {
          mailboxAddress = getMailboxAddress(networkName);
          console.log(`Using default Mailbox for ${networkName}:`, mailboxAddress);
        } catch (error) {
          throw new Error(`Mailbox address not found for network ${networkName}. Please provide --mailbox parameter.`);
        }
      } else {
        console.log("Mailbox address:", mailboxAddress);
      }

      console.log();

      // Deploy or upgrade
      const verifyContracts = taskArgs.verify === "true";
      const ratingConsumer = await deployContractWithProxy(
        hre,
        "RatingConsumer",
        [mailboxAddress],
        [],
        verifyContracts
      );

      const consumerAddress = await ratingConsumer.getAddress();
      console.log();

      // Verify deployment
      const mailbox = await ratingConsumer.mailbox();
      const owner = await ratingConsumer.owner();
      const version = await ratingConsumer.version();

      console.log("Deployment Verification:");
      console.log("   Mailbox:", mailbox);
      console.log("   Owner:", owner);
      console.log("   Version:", version);
      console.log();

      console.log("Deployment/Upgrade completed successfully!");
      console.log();

      logDeploymentSummary(networkName);

    } catch (error) {
      console.error("\nDeployment failed:", error);
      throw error;
    }
  });
