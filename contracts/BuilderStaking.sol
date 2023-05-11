// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

contract BuilderStaking {
    mapping(address => uint256) public minimalStakes;
    mapping(address => mapping(address => uint256)) public stakes;

    event StakeUpdated(address builder, address searcher, uint256 stake);
    event MinimalStakeUpdated(address builder, uint256 minimalStake);

    /**
     * @notice Deposit stake to builder on behalf of searcher
     * @param _builder The builder address
     */
    function deposit(address _builder) public payable {
        uint256 stake = stakes[_builder][msg.sender];
        uint256 minimalStake = minimalStakes[_builder];
        require(minimalStake > 0, "Builder did not set minimal stake");
        require(msg.value + stake >= minimalStake, "Resulting stake is less than minimal");
        stakes[_builder][msg.sender] += msg.value;

        emit StakeUpdated(_builder, msg.sender, stakes[_builder][msg.sender]);
    }

    /**
     * @notice Withdraw searcher stake from builder
     * @param _builder The builder address
     * @param _amount Amount of stake to withdraw
     */
    function withdraw(address _builder, uint256 _amount) public {
        uint256 stake = stakes[_builder][msg.sender];
        require(stake >= _amount, "Balance is less than amount");

        stakes[_builder][msg.sender] -= _amount;
        emit StakeUpdated(_builder, msg.sender, stakes[_builder][msg.sender]);

        (bool sent, ) = address(msg.sender).call{value: _amount}("");
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
     * @param _builder The searcher address
     * @return _hasMinimalStake True if searcher staked to builder a minimal amount
     */
    function hasMinimalStake(address _builder, address _searcher) public view returns (bool) {
        return minimalStakes[_builder] > 0 && stakes[_builder][_searcher] >= minimalStakes[_builder];
    }
}
