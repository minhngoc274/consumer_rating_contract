import { expect } from "chai";
import { ethers, upgrades, network } from "hardhat";
import { RatingSender, RatingConsumer } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-toolbox/node_modules/@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Cross-Chain Rating System Test", function () {
  let ratingSender: RatingSender;
  let ratingConsumer: RatingConsumer;
  let owner: SignerWithAddress;
  let borrower: SignerWithAddress;
  let mailboxSigner: SignerWithAddress;

  // Ethereum Mainnet Hyperlane configuration
  const ETHEREUM_MAILBOX = "0xc005dc82818d67AF737725bD4bf75435d065D239";
  const ETHEREUM_DOMAIN = 1;
  const ARBITRUM_DOMAIN = 42161;

  before(async function () {
    this.timeout(120000);

    if (process.env.FORK_ENABLED !== "true") {
      this.skip();
    }

    [owner, borrower] = await ethers.getSigners();

    const RatingSenderFactory = await ethers.getContractFactory("RatingSender");
    ratingSender = await upgrades.deployProxy(
      RatingSenderFactory,
      [ETHEREUM_MAILBOX],
      { initializer: "initialize" }
    ) as unknown as RatingSender;
    await ratingSender.waitForDeployment();

    const RatingConsumerFactory = await ethers.getContractFactory("RatingConsumer");
    ratingConsumer = await upgrades.deployProxy(
      RatingConsumerFactory,
      [ETHEREUM_MAILBOX],
      { initializer: "initialize" }
    ) as unknown as RatingConsumer;
    await ratingConsumer.waitForDeployment();

    const consumerBytes32 = ethers.zeroPadValue(await ratingConsumer.getAddress(), 32);
    await ratingSender.setDestinationRecipient(ARBITRUM_DOMAIN, consumerBytes32);

    const senderBytes32 = ethers.zeroPadValue(await ratingSender.getAddress(), 32);
    await ratingConsumer.setAuthorizedSender(ETHEREUM_DOMAIN, senderBytes32);

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ETHEREUM_MAILBOX],
    });

    await network.provider.send("hardhat_setBalance", [
      ETHEREUM_MAILBOX,
      "0xDE0B6B3A7640000",
    ]);

    mailboxSigner = await ethers.getSigner(ETHEREUM_MAILBOX);
  });

  after(async function () {
    if (process.env.FORK_ENABLED === "true") {
      await network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [ETHEREUM_MAILBOX],
      });
    }
  });

  describe("Full Cross-Chain Flow", function () {
    it("Should send rating and simulate cross-chain delivery", async function () {
      this.timeout(120000);
      const score = 85;
      const gasPayment = ethers.parseEther("0.01");

      // Send rating
      const tx = await ratingSender.sendRating(
        ARBITRUM_DOMAIN,
        borrower.address,
        score,
        { value: gasPayment }
      );

      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;

      const ratingSentLog = receipt!.logs.find((log: any) => {
        try {
          return ratingSender.interface.parseLog(log)?.name === "RatingSent";
        } catch {
          return false;
        }
      });

      expect(ratingSentLog).to.not.be.undefined;
      const parsedLog = ratingSender.interface.parseLog(ratingSentLog as any);
      const timestamp = parsedLog!.args.timestamp;

      console.log("      Rating sent");
      console.log("      Message ID:", parsedLog!.args.messageId);

      // Simulate message arrival at RatingConsumer
      const messageBody = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint8", "uint256"],
        [borrower.address, score, timestamp]
      );

      const senderBytes32 = ethers.zeroPadValue(await ratingSender.getAddress(), 32);

      console.log("\n   Delivering message to RatingConsumer...");

      const handleTx = await ratingConsumer.connect(mailboxSigner).handle(
        ETHEREUM_DOMAIN,
        senderBytes32,
        messageBody
      );
      const handleReceipt = await handleTx.wait();
      const block = await ethers.provider.getBlock(handleReceipt!.blockNumber);

      await expect(handleTx)
        .to.emit(ratingConsumer, "RatingUpdated")
        .withArgs(borrower.address, score, timestamp, block!.timestamp);

      console.log("      Rating received and stored");

      // Verify rating data
      const rating = await ratingConsumer.getBorrowerRating(borrower.address);
      expect(rating.score).to.equal(score);
      expect(rating.timestamp).to.equal(timestamp);
      expect(rating.isValid).to.be.true;

      console.log("\n   Rating verified:");
      console.log("      Score:", rating.score);
      console.log("      Timestamp:", rating.timestamp);
      console.log("      Valid:", rating.isValid);

      // Verify LTV calculation
      const ltv = await ratingConsumer.getBorrowerLTV(borrower.address);
      expect(ltv).to.equal(75);

      console.log("      LTV:", ltv + "%");
    });

    it("Should handle multiple ratings for different borrowers", async function () {
      this.timeout(120000);
      const borrowers = [
        { address: owner.address, score: 90 },
        { address: borrower.address, score: 65 },
        { address: ethers.Wallet.createRandom().address, score: 40 },
      ];

      console.log("\n   Sending batch ratings...");

      for (const { address, score } of borrowers) {
        // Send rating
        const tx = await ratingSender.sendRating(
          ARBITRUM_DOMAIN,
          address,
          score,
          { value: ethers.parseEther("0.01") }
        );

        const receipt = await tx.wait();
        const log = receipt!.logs.find((l: any) => {
          try {
            return ratingSender.interface.parseLog(l)?.name === "RatingSent";
          } catch {
            return false;
          }
        });

        const parsedLog = ratingSender.interface.parseLog(log as any);
        const timestamp = parsedLog!.args.timestamp;

        // Deliver message
        const messageBody = ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "uint8", "uint256"],
          [address, score, timestamp]
        );

        const senderBytes32 = ethers.zeroPadValue(await ratingSender.getAddress(), 32);

        await ratingConsumer.connect(mailboxSigner).handle(
          ETHEREUM_DOMAIN,
          senderBytes32,
          messageBody
        );

        console.log(`      Rating ${score} sent for ${address.substring(0, 10)}...`);
      }

      // Verify all LTVs
      expect(await ratingConsumer.getBorrowerLTV(borrowers[0].address)).to.equal(75); // 90 -> 75%
      expect(await ratingConsumer.getBorrowerLTV(borrowers[1].address)).to.equal(60); // 65 -> 60%
      expect(await ratingConsumer.getBorrowerLTV(borrowers[2].address)).to.equal(40); // 40 -> 40%

      console.log("      All LTVs calculated correctly");
    });

    it("Should reject replay attack in cross-chain scenario", async function () {
      const score = 75;
      const tx = await ratingSender.sendRating(
        ARBITRUM_DOMAIN,
        borrower.address,
        score,
        { value: ethers.parseEther("0.01") }
      );

      const receipt = await tx.wait();
      const log = receipt!.logs.find((l: any) => {
        try {
          return ratingSender.interface.parseLog(l)?.name === "RatingSent";
        } catch {
          return false;
        }
      });

      const parsedLog = ratingSender.interface.parseLog(log as any);
      const timestamp = parsedLog!.args.timestamp;

      const messageBody = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint8", "uint256"],
        [borrower.address, score, timestamp]
      );

      const senderBytes32 = ethers.zeroPadValue(await ratingSender.getAddress(), 32);

      // First delivery succeeds
      await ratingConsumer.connect(mailboxSigner).handle(
        ETHEREUM_DOMAIN,
        senderBytes32,
        messageBody
      );

      // Replay attempt should fail
      await expect(
        ratingConsumer.connect(mailboxSigner).handle(
          ETHEREUM_DOMAIN,
          senderBytes32,
          messageBody
        )
      )
        .to.be.revertedWithCustomError(ratingConsumer, "ReplayAttack");

      console.log("      Replay attack prevented");
    });

    it("Should update borrower rating over time", async function () {
      const borrowerAddr = ethers.Wallet.createRandom().address;

      // Initial rating
      let score = 50;
      let tx = await ratingSender.sendRating(
        ARBITRUM_DOMAIN,
        borrowerAddr,
        score,
        { value: ethers.parseEther("0.01") }
      );

      let receipt = await tx.wait();
      let log = receipt!.logs.find((l: any) => {
        try {
          return ratingSender.interface.parseLog(l)?.name === "RatingSent";
        } catch {
          return false;
        }
      });

      let parsedLog = ratingSender.interface.parseLog(log as any);
      let timestamp = parsedLog!.args.timestamp;

      let messageBody = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint8", "uint256"],
        [borrowerAddr, score, timestamp]
      );

      const senderBytes32 = ethers.zeroPadValue(await ratingSender.getAddress(), 32);

      await ratingConsumer.connect(mailboxSigner).handle(
        ETHEREUM_DOMAIN,
        senderBytes32,
        messageBody
      );

      let ltv = await ratingConsumer.getBorrowerLTV(borrowerAddr);
      expect(ltv).to.equal(60);

      console.log("      Initial rating:", score, "-> LTV:", ltv + "%");

      await time.increase(3600); // 1 hour later

      // Updated rating
      score = 85;
      tx = await ratingSender.sendRating(
        ARBITRUM_DOMAIN,
        borrowerAddr,
        score,
        { value: ethers.parseEther("0.01") }
      );

      receipt = await tx.wait();
      log = receipt!.logs.find((l: any) => {
        try {
          return ratingSender.interface.parseLog(l)?.name === "RatingSent";
        } catch {
          return false;
        }
      });

      parsedLog = ratingSender.interface.parseLog(log as any);
      timestamp = parsedLog!.args.timestamp;

      messageBody = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint8", "uint256"],
        [borrowerAddr, score, timestamp]
      );

      await ratingConsumer.connect(mailboxSigner).handle(
        ETHEREUM_DOMAIN,
        senderBytes32,
        messageBody
      );

      ltv = await ratingConsumer.getBorrowerLTV(borrowerAddr);
      expect(ltv).to.equal(75); // Score 85 -> 75% LTV

      console.log("      Updated rating:", score, "-> LTV:", ltv + "%");
      console.log("      Rating successfully updated");
    });
  });

  describe("Batch Rating Flow", function () {
    it("Should handle batch ratings correctly", async function () {
      const addresses = [
        ethers.Wallet.createRandom().address,
        ethers.Wallet.createRandom().address,
        ethers.Wallet.createRandom().address,
      ];
      const scores = [80, 60, 35];

      console.log("\n   Sending batch of 3 ratings...");

      const tx = await ratingSender.sendRatingBatch(
        ARBITRUM_DOMAIN,
        addresses,
        scores,
        { value: ethers.parseEther("0.03") }
      );

      const receipt = await tx.wait();

      // Find all RatingSent events
      const sentLogs = receipt!.logs.filter((l: any) => {
        try {
          return ratingSender.interface.parseLog(l)?.name === "RatingSent";
        } catch {
          return false;
        }
      });

      expect(sentLogs).to.have.length(3);
      console.log("      All 3 ratings sent");

      // Deliver each message
      const senderBytes32 = ethers.zeroPadValue(await ratingSender.getAddress(), 32);

      for (let i = 0; i < addresses.length; i++) {
        const parsedLog = ratingSender.interface.parseLog(sentLogs[i] as any);
        const timestamp = parsedLog!.args.timestamp;

        const messageBody = ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "uint8", "uint256"],
          [addresses[i], scores[i], timestamp]
        );

        await ratingConsumer.connect(mailboxSigner).handle(
          ETHEREUM_DOMAIN,
          senderBytes32,
          messageBody
        );
      }

      console.log("      All 3 ratings delivered");

      // Verify LTVs
      expect(await ratingConsumer.getBorrowerLTV(addresses[0])).to.equal(75); // 80 -> 75%
      expect(await ratingConsumer.getBorrowerLTV(addresses[1])).to.equal(60); // 60 -> 60%
      expect(await ratingConsumer.getBorrowerLTV(addresses[2])).to.equal(40); // 35 -> 40%

      console.log("      All LTVs verified");
    });
  });
});
