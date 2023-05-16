import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("BuilderStaking", function () {
  async function deployBuilderStaking() {
    const [builder, searcher, pseudoSearcher] = await ethers.getSigners();

    const BuilderStaking = await ethers.getContractFactory("BuilderStaking");
    const builderStaking = await BuilderStaking.deploy();

    return { builderStaking, builder, searcher, pseudoSearcher };
  }

  function getCommitment(pseudoSearcher: string, builder: string): string {
    return ethers.utils.keccak256(ethers.utils.concat([pseudoSearcher, builder]))
  }

  describe("Deposits", function () {
    it("Should revert if minimal stake is not set", async function () {
      const { builderStaking, builder, searcher, pseudoSearcher } = await loadFixture(deployBuilderStaking);

      const commitment = getCommitment(pseudoSearcher.address, builder.address);
      await builderStaking.connect(searcher).deposit(commitment, { value: 100 })
    });

    it("Should deposit successfully", async function () {
      const { builderStaking, builder, searcher, pseudoSearcher } = await loadFixture(deployBuilderStaking);


      const commitment = getCommitment(pseudoSearcher.address, builder.address);
      await builderStaking.connect(builder).setMinimalStake(100);
      await expect(builderStaking.connect(searcher).deposit(commitment, { value: 100 }))
        .to.emit(builderStaking, "StakeUpdated")
        .withArgs(searcher.address, commitment, 100);

      expect(await builderStaking.stakes(searcher.address, commitment)).to.equal(100);
      expect(await builderStaking.provider.getBalance(builderStaking.address)).to.be.equal(100);
    });
  });

  describe("Withdrawals", function () {
    it("Should revent if there is no stake", async function () {
      const { builderStaking, builder, searcher, pseudoSearcher } = await loadFixture(deployBuilderStaking);
      const commitment = getCommitment(pseudoSearcher.address, builder.address);

      await expect(builderStaking.connect(searcher).withdraw(commitment)).to.be.revertedWith(
        "Nothing to withdraw"
      );
    });

    it("Should withdraw successfully", async function () {
      const { builderStaking, builder, searcher, pseudoSearcher } = await loadFixture(deployBuilderStaking);
      const commitment = getCommitment(pseudoSearcher.address, builder.address);

      await builderStaking.connect(searcher).deposit(commitment, { value: 100 });

      expect(await builderStaking.provider.getBalance(builderStaking.address)).to.be.equal(100);

      await expect(builderStaking.connect(searcher).withdraw(commitment))
        .to.emit(builderStaking, "StakeUpdated")
        .withArgs(searcher.address, commitment, 0);

      expect(await builderStaking.provider.getBalance(builderStaking.address)).to.be.equal(0);
    });
  });

  describe("MinimalStake", function () {
    it("Should set minimal stake", async function () {
      const { builderStaking, builder } = await loadFixture(deployBuilderStaking);

      await expect(builderStaking.connect(builder).setMinimalStake(1000))
        .to.emit(builderStaking, "MinimalStakeUpdated")
        .withArgs(builder.address, 1000);

      await expect(builderStaking.connect(builder).setMinimalStake(2000))
        .to.emit(builderStaking, "MinimalStakeUpdated")
        .withArgs(builder.address, 2000);
    });

    it("Should change has minimal stake state", async function () {
      const { builderStaking, builder, searcher, pseudoSearcher } = await loadFixture(deployBuilderStaking);
      const commitment = getCommitment(pseudoSearcher.address, builder.address);

      await expect(builderStaking.connect(builder).setMinimalStake(1000))
        .to.emit(builderStaking, "MinimalStakeUpdated")
        .withArgs(builder.address, 1000);

      await builderStaking.connect(searcher).deposit(commitment, { value: 1000 });
      expect(await builderStaking.hasMinimalStake(builder.address, searcher.address, commitment)).to.be.equal(true);

      await expect(builderStaking.connect(builder).setMinimalStake(2000))
        .to.emit(builderStaking, "MinimalStakeUpdated")
        .withArgs(builder.address, 2000);

      expect(await builderStaking.hasMinimalStake(builder.address, searcher.address, commitment)).to.be.equal(false);
    });
  });
});
