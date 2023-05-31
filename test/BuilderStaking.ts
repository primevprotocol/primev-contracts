import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("BuilderStaking", function () {
  async function deployBuilderStaking() {
    const [owner, builder, searcher, searcher2, commitmentAccount] = await ethers.getSigners();

    const BuilderStaking = await ethers.getContractFactory("BuilderStaking");
    const builderStaking = await BuilderStaking.deploy();

    return { builderStaking, owner, builder, searcher, searcher2, commitmentAccount };
  }

  function getCommitment(commitmentAccount: string, builder: string): string {
    return ethers.utils.solidityKeccak256(['address', 'address'], [commitmentAccount, builder]);
  }

  describe("Deposits", function () {
    it("Should deposit successfully", async function () {
      const { builderStaking, builder, searcher, searcher2, commitmentAccount } = await loadFixture(deployBuilderStaking);

      const minimalStake = 100;
      const minimalSubscriptionPeriod = 1000;
      await builderStaking.connect(builder).updateBuilder(minimalStake, minimalSubscriptionPeriod);

      const blockNumber = (await builderStaking.provider.getBlock('latest')).number;

      const commitment = getCommitment(commitmentAccount.address, builder.address);
      await expect(builderStaking.connect(searcher).deposit(builder.address, commitment, { value: 100 }))
        .to.emit(builderStaking, "StakeUpdated")
        .withArgs(builder.address, commitment, 100, blockNumber + minimalSubscriptionPeriod + 1);
      await expect(builderStaking.connect(searcher2).deposit(builder.address, commitment, { value: 200 }))
        .to.emit(builderStaking, "StakeUpdated")
        .withArgs(builder.address, commitment, 300, blockNumber + minimalSubscriptionPeriod * 3 + 1);

      expect((await builderStaking.stakes(commitment)).stake).to.equal(300);
      expect(await builderStaking.provider.getBalance(builderStaking.address)).to.be.equal(300 * 0.8);
    });
  });

  describe("Withdrawals", function () {
    it("Should revert if there is no balance", async function () {
      const { builderStaking, builder, searcher, commitmentAccount } = await loadFixture(deployBuilderStaking);

      await expect(builderStaking.connect(builder).withdraw()).to.be.revertedWith(
        "No locked funds"
      );

      const minimalStake = 100;
      const minimalSubscriptionPeriod = 1000;

      const commitment = getCommitment(commitmentAccount.address, builder.address);
      await builderStaking.connect(builder).updateBuilder(minimalStake, minimalSubscriptionPeriod);
      await builderStaking.connect(searcher).deposit(builder.address, commitment, { value: 100 });

      await expect(builderStaking.connect(builder).withdraw()).to.be.revertedWith(
        "Nothing to withdraw"
      );
    });

    it("Should withdraw successfully", async function () {
      const { builderStaking, builder, searcher, searcher2, commitmentAccount } = await loadFixture(deployBuilderStaking);
      const minimalStake = 50;
      const minimalSubscriptionPeriod = 1000;
      const commitment = getCommitment(commitmentAccount.address, builder.address);

      await builderStaking.connect(builder).updateBuilder(minimalStake, minimalSubscriptionPeriod);

      await builderStaking.connect(searcher).deposit(builder.address, commitment, { value: 100 });
      expect((await builderStaking.stakes(commitment)).stake).to.be.equal(100);

      await builderStaking.connect(searcher2).deposit(builder.address, commitment, { value: 50 })
      expect((await builderStaking.stakes(commitment)).stake).to.be.equal(150);

      expect(await builderStaking.provider.getBalance(builderStaking.address)).to.be.equal(150 * 0.8);

      await expect(builderStaking.connect(builder).withdraw()).to.be.revertedWith(
        "Nothing to withdraw"
      );

      expect(await builderStaking.connect(builder).timeLocksCount(builder.address)).to.be.equal(2);

      await mine(minimalSubscriptionPeriod);

      await expect(builderStaking.connect(builder).withdraw())
        .to.emit(builderStaking, "Withdrawal")
        .withArgs(builder.address, 100 * 0.8);

      expect(await builderStaking.provider.getBalance(builderStaking.address)).to.be.equal(50 * 0.8);
      expect(await builderStaking.connect(builder).timeLocksCount(builder.address)).to.be.equal(1);

      await mine(minimalSubscriptionPeriod);

      await expect(builderStaking.connect(builder).withdraw())
        .to.emit(builderStaking, "Withdrawal")
        .withArgs(builder.address, 50 * 0.8);
      expect(await builderStaking.connect(builder).timeLocksCount(builder.address)).to.be.equal(0);

      expect(await builderStaking.provider.getBalance(builderStaking.address)).to.be.equal(0);
    });
  });

  describe("MinimalStake", function () {
    it("Should set minimal stake", async function () {
      const { builderStaking, builder } = await loadFixture(deployBuilderStaking);

      await expect(await builderStaking.connect(builder).updateBuilder(100, 1000))
        .to.emit(builderStaking, "BuilderUpdated")
        .withArgs(builder.address, 100, 1000);

      await expect(await builderStaking.connect(builder).updateBuilder(200, 2000))
        .to.emit(builderStaking, "BuilderUpdated")
        .withArgs(builder.address, 200, 2000);
    });

    it("Should change has minimal stake state", async function () {
      const { builderStaking, builder, searcher, commitmentAccount } = await loadFixture(deployBuilderStaking);
      const commitment = getCommitment(commitmentAccount.address, builder.address);

      await expect(await builderStaking.connect(builder).updateBuilder(1000, 1000))
        .to.emit(builderStaking, "BuilderUpdated")
        .withArgs(builder.address, 1000, 1000);

      await builderStaking.connect(searcher).deposit(builder.address, commitment, { value: 1000 });
      expect(await builderStaking.hasMinimalStake(builder.address, commitment)).to.be.equal(true);

      await expect(await builderStaking.connect(builder).updateBuilder(2000, 2000))
        .to.emit(builderStaking, "BuilderUpdated")
        .withArgs(builder.address, 2000, 2000);

      expect(await builderStaking.hasMinimalStake(builder.address, commitment)).to.be.equal(false);
    });
  });
});
