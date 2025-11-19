import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { deployContractWithProxy, logDeploymentSummary } from "./utils";
import { getChainConfig, getMailboxAddress, getDomainId } from "./constants";

task("deployRatingSender", "Deploy or upgrade RatingSender contract")
  .addOptionalParam("mailbox", "Hyperlane Mailbox address (if not provided, uses default for network)")
  .addOptionalParam("verify", "Verify contract on block explorer", "false")
  .setAction(async (taskArgs: any, hre: HardhatRuntimeEnvironment) => {
    const networkName = hre.network.name;
    console.log(`\nDeploying/Upgrading RatingSender on ${networkName}\n`);

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
      const ratingSender = await deployContractWithProxy(
        hre,
        "RatingSender",
        [mailboxAddress],
        [],
        verifyContracts
      );

      const senderAddress = await ratingSender.getAddress();
      console.log();

      // Verify deployment
      const mailbox = await ratingSender.mailbox();
      const owner = await ratingSender.owner();
      const version = await ratingSender.version();
      const isOwnerRater = await ratingSender.authorizedRaters(owner);

      console.log("Deployment Verification:");
      console.log("   Mailbox:", mailbox);
      console.log("   Owner:", owner);
      console.log("   Owner is authorized rater:", isOwnerRater);
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
