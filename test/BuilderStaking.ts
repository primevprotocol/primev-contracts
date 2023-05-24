import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
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

      const commitment = getCommitment(commitmentAccount.address, builder.address);
      await builderStaking.connect(builder).setMinimalStake(100);
      await expect(builderStaking.connect(searcher).deposit(builder.address, commitment, { value: 100 }))
        .to.emit(builderStaking, "StakeUpdated")
        .withArgs(builder.address, commitment, 100);
      await expect(builderStaking.connect(searcher2).deposit(builder.address, commitment, { value: 50 }))
        .to.emit(builderStaking, "StakeUpdated")
        .withArgs(builder.address, commitment, 150);

      expect(await builderStaking.stakes(commitment)).to.equal(150);
      expect(await builderStaking.provider.getBalance(builderStaking.address)).to.be.equal(150);
    });
  });

  describe("Withdrawals", function () {
    it("Should revert if there is no balance", async function () {
      const { builderStaking, searcher } = await loadFixture(deployBuilderStaking);

      await expect(builderStaking.connect(searcher).withdraw()).to.be.revertedWith(
        "Nothing to withdraw"
      );
    });

    it("Should withdraw successfully", async function () {
      const { builderStaking, owner, builder, searcher, searcher2, commitmentAccount } = await loadFixture(deployBuilderStaking);
      const commitment = getCommitment(commitmentAccount.address, builder.address);

      await builderStaking.connect(searcher).deposit(builder.address, commitment, { value: 100 });
      expect(await builderStaking.balances(builder.address)).to.be.equal(80);

      await builderStaking.connect(searcher2).deposit(builder.address, commitment, { value: 50 })
      expect(await builderStaking.balances(builder.address)).to.be.equal(120);

      expect(await builderStaking.provider.getBalance(builderStaking.address)).to.be.equal(150);

      await expect(builderStaking.connect(builder).withdraw())
        .to.emit(builderStaking, "BalanceUpdated")
        .withArgs(builder.address, 0);

      expect(await builderStaking.balances(builder.address)).to.be.equal(0);
      expect(await builderStaking.balances(owner.address)).to.be.equal(30);

      expect(await builderStaking.provider.getBalance(builderStaking.address)).to.be.equal(30);
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
      const { builderStaking, builder, searcher, commitmentAccount } = await loadFixture(deployBuilderStaking);
      const commitment = getCommitment(commitmentAccount.address, builder.address);

      await expect(builderStaking.connect(builder).setMinimalStake(1000))
        .to.emit(builderStaking, "MinimalStakeUpdated")
        .withArgs(builder.address, 1000);

      await builderStaking.connect(searcher).deposit(builder.address, commitment, { value: 1000 });
      expect(await builderStaking.hasMinimalStake(builder.address, commitment)).to.be.equal(true);

      await expect(builderStaking.connect(builder).setMinimalStake(2000))
        .to.emit(builderStaking, "MinimalStakeUpdated")
        .withArgs(builder.address, 2000);

      expect(await builderStaking.hasMinimalStake(builder.address, commitment)).to.be.equal(false);
    });
  });
});
