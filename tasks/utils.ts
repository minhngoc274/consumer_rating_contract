import * as fs from "fs";
import * as path from "path";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Contract } from "ethers";

const deploymentsPath = path.join(__dirname, "..", "deployments");

export interface DeploymentAddresses {
  [networkName: string]: {
    [contractName: string]: string;
  };
}

export const readDeployedAddressesWithNetwork = (networkName: string): any => {
  const filePath = path.join(deploymentsPath, `${networkName}.json`);
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content);
};

export const writeDeployedAddressesWithNetwork = (
  networkName: string,
  contractName: string,
  address: string
): void => {
  if (!fs.existsSync(deploymentsPath)) {
    fs.mkdirSync(deploymentsPath, { recursive: true });
  }

  const filePath = path.join(deploymentsPath, `${networkName}.json`);
  let addresses: any = {};

  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf8");
    addresses = JSON.parse(content);
  }

  addresses[contractName] = address;
  fs.writeFileSync(filePath, JSON.stringify(addresses, null, 2));
};

export const deployContractWithProxy = async (
  hre: HardhatRuntimeEnvironment,
  contractName: string,
  initArgs: any[],
  constructorArgs: any[] = [],
  verify: boolean = false
): Promise<Contract> => {
  const networkName = hre.network.name;
  const existingAddresses = readDeployedAddressesWithNetwork(networkName);
  const { upgrades, ethers } = hre;
  const ContractFactory = await ethers.getContractFactory(contractName);

  let deployedContract: Contract;
  let contractAddress: string;

  if (existingAddresses[contractName]) {
    // UPGRADE existing proxy
    console.log(`\n=== Upgrading ${contractName} (Proxy) on ${networkName} ===`);
    const proxyAddress = existingAddresses[contractName];
    console.log(`Existing proxy: ${proxyAddress}`);

    deployedContract = await upgrades.upgradeProxy(proxyAddress, ContractFactory, {
      constructorArgs: constructorArgs,
      unsafeAllowCustomTypes: true,
      unsafeAllow: ["constructor", "state-variable-immutable", "delegatecall"],
      redeployImplementation: "always",
    });

    await deployedContract.waitForDeployment();
    contractAddress = await deployedContract.getAddress();
    console.log(`${contractName} upgraded successfully! Address: ${contractAddress}`);

    // Get implementation address
    const implAddress = await upgrades.erc1967.getImplementationAddress(contractAddress);
    console.log(`New implementation: ${implAddress}`);
  } else {
    // DEPLOY new proxy
    console.log(`\n=== Deploying ${contractName} (Proxy) on ${networkName} ===`);
    deployedContract = await upgrades.deployProxy(
      ContractFactory,
      initArgs,
      {
        initializer: 'initialize',
        constructorArgs: constructorArgs,
        unsafeAllowCustomTypes: true,
        unsafeAllow: ["constructor", "state-variable-immutable", "delegatecall"],
      }
    );

    await deployedContract.waitForDeployment();
    contractAddress = await deployedContract.getAddress();
    console.log(`${contractName} proxy deployed to: ${contractAddress}`);

    // Get implementation address
    const implAddress = await upgrades.erc1967.getImplementationAddress(contractAddress);
    console.log(`Implementation: ${implAddress}`);

    // Save new address to deployments
    writeDeployedAddressesWithNetwork(networkName, contractName, contractAddress);
  }

  if (verify && hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log(`\nVerifying ${contractName}...`);
    try {
      const implAddress = await upgrades.erc1967.getImplementationAddress(contractAddress);
      await hre.run("verify:verify", {
        address: implAddress,
        constructorArguments: constructorArgs,
      });
      console.log(`${contractName} verified successfully`);
    } catch (error: any) {
      console.log(`Verification failed for ${contractName}:`, error.message);
    }
  }

  return deployedContract;
};

export const deployContract = async (
  hre: HardhatRuntimeEnvironment,
  contractName: string,
  constructorArgs: any[] = [],
  verify: boolean = false
): Promise<Contract> => {
  const networkName = hre.network.name;
  const existingAddresses = readDeployedAddressesWithNetwork(networkName);

  // Check if contract already deployed
  if (existingAddresses[contractName]) {
    console.log(`\n=== ${contractName} already deployed on ${networkName} ===`);
    const existingAddress = existingAddresses[contractName];
    console.log(`Existing address: ${existingAddress}`);

    const { ethers } = hre;
    const ContractFactory = await ethers.getContractFactory(contractName);
    return ContractFactory.attach(existingAddress);
  }

  console.log(`\n=== Deploying ${contractName} on ${networkName} ===`);

  const { ethers } = hre;
  const ContractFactory = await ethers.getContractFactory(contractName);
  const deployedContract = await ContractFactory.deploy(...constructorArgs);

  await deployedContract.waitForDeployment();
  const contractAddress = await deployedContract.getAddress();

  console.log(`${contractName} deployed to: ${contractAddress}`);

  // Save address to deployments
  writeDeployedAddressesWithNetwork(networkName, contractName, contractAddress);

  if (verify && hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log(`Verifying ${contractName}...`);
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: constructorArgs,
      });
      console.log(`${contractName} verified successfully`);
    } catch (error: any) {
      console.log(`Verification failed for ${contractName}:`, error.message);
    }
  }

  return deployedContract;
};

export const getDeployedContract = async (
  hre: HardhatRuntimeEnvironment,
  contractName: string,
  networkName?: string
): Promise<any> => {
  const network = networkName || hre.network.name;
  const addresses = readDeployedAddressesWithNetwork(network);

  if (!addresses[contractName]) {
    throw new Error(`${contractName} not found in deployments for ${network}`);
  }

  const { ethers } = hre;
  const ContractFactory = await ethers.getContractFactory(contractName);
  return ContractFactory.attach(addresses[contractName]);
};

export const logDeploymentSummary = (networkName: string): void => {
  const addresses = readDeployedAddressesWithNetwork(networkName);

  console.log(`\n=== Deployment Summary for ${networkName} ===`);
  for (const [contractName, address] of Object.entries(addresses)) {
    console.log(`${contractName}: ${address}`);
  }
  console.log("=======================================\n");
};

export const waitForConfirmations = async (
  tx: any,
  confirmations: number = 1
): Promise<void> => {
  console.log(`Waiting for ${confirmations} confirmation(s)...`);
  await tx.wait(confirmations);
  console.log("Transaction confirmed!");
};
