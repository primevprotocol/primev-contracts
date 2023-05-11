# Primev Contracts

This project allows to deploy Primev contracts

## Initialize

```
$ npm install && npx hardhat compile
```

## Run Tests

```
$ npx hardhat test
```

Optionally you can enable gas reporting while testing

```
$ REPORT_GAS=true npx hardhat test
```

## Deploy Contracts to Sepolia

Make sure `PRIVATE_KEY` and `INFURA_API_KEY` variables are set inside `.env` file

```
$ npx hardhat run scripts/deploy.ts --network sepolia
```

## Verify Contracts on Sepolia Explorer

Make sure `ETHERSCAN_API_KEY` variable is set inside `.env` file. Replace `0x0` in script with an address of the deployed contract.

```
$ npx hardhat run scripts/deploy.ts --network sepolia 0x0
```
