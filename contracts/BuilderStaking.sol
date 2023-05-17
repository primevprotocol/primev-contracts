// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

contract BuilderStaking {
    // builder -> minimal stake
    mapping(address => uint256) public minimalStakes;

    // searcher -> commitment -> amount
    mapping(address => mapping(bytes32 => uint256)) public stakes;

    event StakeUpdated(address searcher, bytes32 commitment, uint256 stake);
    event MinimalStakeUpdated(address builder, uint256 minimalStake);

    /**
     * @notice Deposit stake to builder on behalf of searcher using commitment hash
     * @param _commitment The commitment hash
     */
    function deposit(bytes32 _commitment) public payable {
        stakes[msg.sender][_commitment] += msg.value;

        emit StakeUpdated(
            msg.sender,
            _commitment,
            stakes[msg.sender][_commitment]
        );
    }

    /**
     * @notice Withdraw searcher stake from builder using commitment hash
     * @param _commitment The commitment hash
     */
    function withdraw(bytes32 _commitment) public {
        uint256 stake = stakes[msg.sender][_commitment];
        require(stake > 0, "Nothing to withdraw");

        stakes[msg.sender][_commitment] = 0;
        emit StakeUpdated(msg.sender, _commitment, 0);

        (bool sent, ) = address(msg.sender).call{value: stake}("");
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
     * @param _searcher The searcher address
     * @param _commitment The commitment hash
     * @return _hasMinimalStake True if searcher staked to builder a minimal amount
     */
    function hasMinimalStake(
        address _builder,
        address _searcher,
        bytes32 _commitment
    ) public view returns (bool) {
        return
            minimalStakes[_builder] > 0 &&
            stakes[_searcher][_commitment] >= minimalStakes[_builder];
    }

    /**
     * @notice Get commitment hash by commitment account and builder
     * @param _commitmentAccount The commitment account address
     * @param _builder The builder address
     * @return _commitment The commitment hash
     */
    function getCommitment(
        address _commitmentAccount,
        address _builder
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_commitmentAccount, _builder));
    }
}
