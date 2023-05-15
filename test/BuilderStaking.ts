import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("BuilderStaking", function () {
  async function deployBuilderStaking() {
    const [builder, searcher] = await ethers.getSigners();

    const BuilderStaking = await ethers.getContractFactory("BuilderStaking");
    const builderStaking = await BuilderStaking.deploy();

    return { builderStaking, builder, searcher };
  }

  describe("Deposits", function () {
    it("Should revert if minimal stake is not set", async function () {
      const { builderStaking, builder, searcher } = await loadFixture(deployBuilderStaking);

      await expect(builderStaking.connect(searcher).deposit(builder.address, { value: 100 })).to.be.revertedWith(
        "Builder did not set minimal stake"
      );
    });

    it("Should revert if resulting stake is less than minimal", async function () {
      const { builderStaking, builder, searcher } = await loadFixture(deployBuilderStaking);

      await builderStaking.connect(builder).setMinimalStake(1000);

      await expect(builderStaking.connect(searcher).deposit(builder.address, { value: 100 })).to.be.revertedWith(
        "Resulting stake is less than minimal"
      );
    });

    it("Should deposit successfully", async function () {
      const { builderStaking, builder, searcher } = await loadFixture(deployBuilderStaking);

      await builderStaking.connect(builder).setMinimalStake(100);
      await expect(builderStaking.connect(searcher).deposit(builder.address, { value: 100 }))
        .to.emit(builderStaking, "StakeUpdated")
        .withArgs(builder.address, searcher.address, 100);

      expect(await builderStaking.connect(builder).getStakeAsBuilder(searcher.address)).to.equal(100);
      expect(await builderStaking.connect(searcher).getStakeAsSearcher(builder.address)).to.equal(100);
      expect(await builderStaking.provider.getBalance(builderStaking.address)).to.be.equal(100);
    });
  });

  describe("Withdrawals", function () {
    it("Should revent if stake is less than withdrawal amount", async function () {
      const { builderStaking, builder, searcher } = await loadFixture(deployBuilderStaking);

      await builderStaking.connect(builder).setMinimalStake(100);
      await builderStaking.connect(searcher).deposit(builder.address, { value: 100 });

      await expect(builderStaking.connect(searcher).withdraw(builder.address, 1000)).to.be.revertedWith(
        "Balance is less than amount"
      );
    });

    it("Should withdraw successfully", async function () {
      const { builderStaking, builder, searcher } = await loadFixture(deployBuilderStaking);

      await builderStaking.connect(builder).setMinimalStake(100);
      await builderStaking.connect(searcher).deposit(builder.address, { value: 100 });

      expect(await builderStaking.provider.getBalance(builderStaking.address)).to.be.equal(100);

      await expect(builderStaking.connect(searcher).withdraw(builder.address, 80))
        .to.emit(builderStaking, "StakeUpdated")
        .withArgs(builder.address, searcher.address, 20);

      expect(await builderStaking.provider.getBalance(builderStaking.address)).to.be.equal(20);

      await expect(builderStaking.connect(searcher).withdraw(builder.address, 20))
        .to.emit(builderStaking, "StakeUpdated")
        .withArgs(builder.address, searcher.address, 0);

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
      const { builderStaking, builder, searcher } = await loadFixture(deployBuilderStaking);

      await expect(builderStaking.connect(builder).setMinimalStake(1000))
        .to.emit(builderStaking, "MinimalStakeUpdated")
        .withArgs(builder.address, 1000);

      await builderStaking.connect(searcher).deposit(builder.address, { value: 1000 });
      expect(await builderStaking.hasMinimalStake(builder.address, searcher.address)).to.be.equal(true);

      await expect(builderStaking.connect(builder).setMinimalStake(2000))
        .to.emit(builderStaking, "MinimalStakeUpdated")
        .withArgs(builder.address, 2000);

      expect(await builderStaking.hasMinimalStake(builder.address, searcher.address)).to.be.equal(false);
    });
  });
});
