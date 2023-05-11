import { ethers } from "hardhat";

async function main() {
  const BuilderStaking = await ethers.getContractFactory("BuilderStaking");
  const builderStaking = await BuilderStaking.deploy();
  
  console.log(`Deploying BuilderStaking tx: ${builderStaking.deployTransaction.hash}`);
  await builderStaking.deployed();

  console.log(`Deployed BuilderStaking at: ${builderStaking.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
