// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

uint256 constant BASE_DIVISOR = 1 ether;

contract BuilderStaking is Ownable {
    struct BuilderInfo {
        uint256 minimalStake;
        uint256 minimalSubscriptionPeriod;
    }

    struct StakeInfo {
        uint256 subscriptionEnd;
        uint256 stake;
    }

    struct TimeLock {
        uint256 initialAmount;
        uint256 remainingAmount;
        uint256 startTime;
        uint256 lockDuration;
    }

    mapping(address => BuilderInfo) public builders;
    mapping(bytes32 => StakeInfo) public stakes;
    mapping(address => TimeLock[]) public timeLocks;

    event StakeUpdated(
        address builder,
        bytes32 commitment,
        uint256 stake,
        uint256 subscriptionEnd
    );
    event BuilderUpdated(
        address builder,
        uint256 minimalStake,
        uint256 minimalSubsriptionPeriod
    );
    event Withdrawal(address builder, uint256 amount);

    /**
     * @notice Deposit stake to builder on behalf of searcher using commitment hash
     * @param _builder The builder address
     * @param _commitment The commitment hash
     */
    function deposit(address _builder, bytes32 _commitment) public payable {
        BuilderInfo memory info = builders[_builder];
        StakeInfo memory stake = stakes[_commitment];
        require(info.minimalStake > 0, "Builder minimal stake is not set");
        require(
            info.minimalSubscriptionPeriod > 0,
            "Builder minimal subscription period is not set"
        );
        require(
            msg.value >= info.minimalStake,
            "Deposit amount is less than minimal stake"
        );

        stake.stake += msg.value;
        uint256 subscriptionPeriod = _getSubscriptionPeriod(
            info.minimalStake,
            info.minimalSubscriptionPeriod,
            msg.value
        );

        if (stake.subscriptionEnd > block.number) {
            stake.subscriptionEnd += subscriptionPeriod;
        } else {
            stake.subscriptionEnd = block.number + subscriptionPeriod;
        }

        stakes[_commitment] = stake;

        address owner = owner();
        uint256 builderAmount = (((msg.value * BASE_DIVISOR) / 100) * 80) /
            BASE_DIVISOR;

        _lockFunds(_builder, builderAmount, info.minimalSubscriptionPeriod);
        (bool sent, ) = owner.call{value: msg.value - builderAmount}("");
        require(sent, "Failed to distribute funds");

        emit StakeUpdated(
            _builder,
            _commitment,
            stake.stake,
            stake.subscriptionEnd
        );
    }

    /**
     * @notice Set minimal stake amount for builder
     * @param _minimalStake The amount of minimal stake
     */
    function updateBuilder(
        uint256 _minimalStake,
        uint256 _minimalSubscriptionPeriod
    ) public {
        BuilderInfo memory info;
        info.minimalStake = _minimalStake;
        info.minimalSubscriptionPeriod = _minimalSubscriptionPeriod;

        builders[msg.sender] = info;

        emit BuilderUpdated(
            msg.sender,
            _minimalStake,
            _minimalSubscriptionPeriod
        );
    }

    /**
     * @notice Withdraw locked funds
     */
    function withdraw() public {
        address _user = msg.sender;
        require(timeLocks[_user].length > 0, "No locked funds");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < timeLocks[_user].length; i++) {
            uint256 elapsedTime = block.timestamp -
                timeLocks[_user][i].startTime;
            if (elapsedTime > timeLocks[_user][i].lockDuration) {
                elapsedTime = timeLocks[_user][i].lockDuration;
            }

            uint256 releasableAmount = (elapsedTime *
                timeLocks[_user][i].initialAmount) /
                timeLocks[_user][i].lockDuration;
            if (releasableAmount > timeLocks[_user][i].remainingAmount) {
                releasableAmount = timeLocks[_user][i].remainingAmount;
            }

            if (releasableAmount > 0) {
                timeLocks[_user][i].remainingAmount -= releasableAmount;
                totalAmount += releasableAmount;
            }

            // if time lock is empty, remove it
            if (timeLocks[_user][i].remainingAmount == 0) {
                _removeTimeLock(_user, i);
            }
        }


        require(totalAmount > 0, "Nothing to withdraw");
        (bool sent, ) = _user.call{value: totalAmount}("");
        require(sent, "Failed to release funds");
        emit Withdrawal(_user, totalAmount);
    }

    /**
     * @notice Calculate amount available to withdraw
     * @return _withdrawableAmount The amount available to withdraw from time locks
     */
    function withdrawableAmount() public view returns (uint256) {
        address _user = msg.sender;
        require(timeLocks[_user].length > 0, "No locked funds");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < timeLocks[_user].length; i++) {
            uint256 elapsedTime = block.timestamp -
                timeLocks[_user][i].startTime;
            if (elapsedTime > timeLocks[_user][i].lockDuration) {
                elapsedTime = timeLocks[_user][i].lockDuration;
            }

            uint256 releasableAmount = (elapsedTime *
                timeLocks[_user][i].initialAmount) /
                timeLocks[_user][i].lockDuration;
            if (releasableAmount > timeLocks[_user][i].remainingAmount) {
                releasableAmount = timeLocks[_user][i].remainingAmount;
            }

            if (releasableAmount > 0) {
                totalAmount += releasableAmount;
            }
        }

        return totalAmount;
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
        uint256 minimalStake = builders[_builder].minimalStake;
        return minimalStake > 0 && stakes[_commitment].stake >= minimalStake;
    }

    /**
     * @notice Get time locks count for specific address
     * @param _address The time locks receiver address
     * @return _timeLocksCount Time locks count for specified receiver
     */
    function timeLocksCount(address _address) public view returns (uint256) {
        return timeLocks[_address].length;
    }

    /**
     * @notice Get subscription period in blocks by builder address
     * @param _builder The builder address
     * @return _subscriptionPeriod Subscription period in blocks
     */
    function getSubscriptionPeriod(
        address _builder,
        uint256 _stakeAmount
    ) public view returns (uint256) {
        BuilderInfo memory info = builders[_builder];
        require(info.minimalStake > 0, "Builder minimal stake is not set");
        require(
            info.minimalSubscriptionPeriod > 0,
            "Builder minimal subscription period is not set"
        );

        return
            _getSubscriptionPeriod(
                info.minimalStake,
                info.minimalSubscriptionPeriod,
                _stakeAmount
            );
    }

    /**
     * @notice Lock funds for block time period for specific address
     * @param _address Lock address
     * @param _amount Lock amount
     * @param _lockDuration Lock duration in blocks
     */
    function _lockFunds(
        address _address,
        uint256 _amount,
        uint256 _lockDuration
    ) private {
        require(_lockDuration > 0, "Lock duration should be positive");
        require(_amount > 0, "Amount should be positive");

        timeLocks[_address].push(
            TimeLock({
                initialAmount: _amount,
                remainingAmount: _amount,
                startTime: block.timestamp,
                lockDuration: _lockDuration
            })
        );
    }

    /**
     * @notice Remove time lock item by address and index
     * @param _address Lock address
     * @param _index Lock index
     */
    function _removeTimeLock(address _address, uint256 _index) private {
        require(_index < timeLocks[_address].length);
        timeLocks[_address][_index] = timeLocks[_address][
            timeLocks[_address].length - 1
        ];
        timeLocks[_address].pop();
    }

    /**
     * @notice Get subscription period in blocks by
     * minimal stake, minimal subscription period and stake amount
     * @param _minimalStake Minimal stake of the builder
     * @param _minimalSubscriptionPeriod Minimal subscription period of the builder
     * @param _stakeAmount Stake amount
     * @return _subscriptionPeriod Subscription period in blocks
     */
    function _getSubscriptionPeriod(
        uint256 _minimalStake,
        uint256 _minimalSubscriptionPeriod,
        uint256 _stakeAmount
    ) private pure returns (uint256) {
        uint256 periodPerStake = (_minimalSubscriptionPeriod * BASE_DIVISOR) /
            _minimalStake;
        return (periodPerStake * _stakeAmount) / BASE_DIVISOR;
    }
}
