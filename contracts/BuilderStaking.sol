// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

uint256 constant BASE_DIVISOR = 1 ether;

contract BuilderStaking is Ownable {
    address public primev;

    // builder -> minimal stake
    mapping(address => uint256) public minimalStakes;

    // commitment -> amount
    mapping(bytes32 => uint256) public stakes;

    // address -> amount
    mapping(address => uint256) public balances;

    event StakeUpdated(address builder, bytes32 commitment, uint256 stake);
    event BalanceUpdated(address builder, uint256 balance);
    event MinimalStakeUpdated(address builder, uint256 minimalStake);

    /**
     * @notice Deposit stake to builder on behalf of searcher using commitment hash
     * @param _builder The builder address
     * @param _commitment The commitment hash
     */
    function deposit(address _builder, bytes32 _commitment) public payable {
        stakes[_commitment] += msg.value;

        uint256 builderAmount = (((msg.value * BASE_DIVISOR) / 100) * 80) / BASE_DIVISOR;
        balances[_builder] += builderAmount;
        balances[primev] += msg.value - builderAmount;

        emit StakeUpdated(_builder, _commitment, stakes[_commitment]);
        emit BalanceUpdated(_builder, balances[_builder]);
        emit BalanceUpdated(primev, balances[primev]);
    }

    /**
     * @notice Withdraw balance from the contract
     */
    function withdraw() public {
        uint256 balance = balances[msg.sender];
        require(balance > 0, "Nothing to withdraw");

        balances[msg.sender] = 0;
        emit BalanceUpdated(msg.sender, 0);

        (bool sent, ) = address(msg.sender).call{value: balance}("");
        require(sent, "Failed to withdraw");
    }

    /**
     * @notice Set minimal stake amount for builder
     * @param _minimalStake The amount of minimal stake
     */
    function setMinimalStake(uint256 _minimalStake) public {
        minimalStakes[msg.sender] = _minimalStake;
        emit MinimalStakeUpdated(msg.sender, _minimalStake);
    }

    /**
     * @notice Verify if searcher staked to builder a minimal amount
     * @param _builder The builder address
     * @param _commitment The commitment hash
     * @return _hasMinimalStake True if searcher staked to builder a minimal amount
     */
    function hasMinimalStake(
        address _builder,
        bytes32 _commitment
    ) public view returns (bool) {
        return
            minimalStakes[_builder] > 0 &&
            stakes[_commitment] >= minimalStakes[_builder];
    }
}
