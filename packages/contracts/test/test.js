const web3 = require("web3");
const { expect } = require("chai");
const { randomBytes } = require("ethers");
const { ethers } = require("hardhat");
const { create } = require("ts-node");

describe("Test an end to end fixed product market maker and conditional tokens", function () {
  let creator, oracle;
  let conditionalTokens
  let collateralToken
  let fpmmDeterministicFactory

  const questionId = randomBytes(32);
  const numOutcomes = 10;
  let conditionId
  let collectionIds


  beforeEach(async function () {
    [creator, oracle] = await ethers.getSigners();
    conditionalTokens = await (
      await ethers.getContractFactory("ConditionalTokens")).deploy();
    collateralToken = await (await ethers.getContractFactory("WETH")).deploy();
    fpmmDeterministicFactory = await (
      await ethers.getContractFactory("FPMMDeterministicFactory")).deploy();

    conditionId = await conditionalTokens.getConditionId(oracle, questionId, numOutcomes);
    collectionIds = Array.from(
      { length: numOutcomes },
      async (_, i) => await conditionalTokens.getCollectionId(conditionId, toBN(1).shln(i))
    );
    positionIds = collectionIds.map(collectionId => conditionalTokens.getPositionId(collateralToken.address, collectionId))
  });

  describe("End to End", function () {
    let fixedProductMarketMaker;
    const saltNonce = 2020
    const feeFactor = 3e15.toString() // (0.3%)
    const initialFunds = 10e18.toString()
    const initialDistribution = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
    const expectedFundedAmounts = initialDistribution.map(n => (1e18 * n).toString())

    it("Create conditional tokens", async function () {
      await collateralToken.deposit({ value: initialFunds, from: creator });
      await collateralToken.approve(await fpmmDeterministicFactory.getAddress(), initialFunds, { from: creator });
      await conditionalTokens.prepareCondition(oracle.address, questionId, numOutcomes)
    });

    it("Create fixed product market maker", async function () {
      const createArgs = [
        saltNonce,
        await conditionalTokens.getAddress(),
        await collateralToken.getAddress(),
        [conditionId],
        feeFactor,
        initialFunds,
        initialDistribution,
        { from: creator }
      ]
      console.log(createArgs)
      const tx = await fpmmDeterministicFactory.create2FixedProductMarketMaker(...createArgs);
      console.log(tx);
    });
  });
});
