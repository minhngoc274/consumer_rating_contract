// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./interfaces/IMessageRecipient.sol";

contract RatingConsumer is Initializable, OwnableUpgradeable, IMessageRecipient {

    struct Rating {
        uint8 score;
        uint256 timestamp;
        uint256 receivedAt;
    }

    // State Variables
    address public mailbox;
    uint256 public maxRatingAge;
    uint256 public defaultLTV;

    mapping(uint32 => bytes32) public authorizedSenders;  // sourceDomain => sender
    mapping(address => Rating) public borrowerRatings;
    mapping(bytes32 => bool) public processedMessages;

    // Events
    event RatingUpdated(address indexed borrower, uint8 score, uint256 timestamp, uint256 receivedAt);
    event StaleRatingRejected(address indexed borrower, uint256 ratingTimestamp, uint256 currentTime);
    event ReplayAttemptBlocked(bytes32 messageHash);
    event AuthorizedSenderUpdated(uint32 indexed sourceDomain, bytes32 indexed sender);
    event MailboxUpdated(address indexed newMailbox);
    event MaxRatingAgeUpdated(uint256 newMaxAge);
    event DefaultLTVUpdated(uint256 newDefaultLTV);

    // Errors
    error UnauthorizedMailbox();
    error UnauthorizedSender();
    error InvalidRatingScore();
    error StaleRating();
    error ReplayAttack();
    error InvalidAddress();

    modifier onlyMailbox() {
        if (msg.sender != mailbox) revert UnauthorizedMailbox();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _mailbox) public initializer {
        if (_mailbox == address(0)) revert InvalidAddress();
        __Ownable_init(msg.sender);

        mailbox = _mailbox;
        maxRatingAge = 24 hours;
        defaultLTV = 40;
    }

    /**
     * @notice Handle incoming cross-chain message from Hyperlane
     * @dev Validates sender, prevents replay, rejects stale data
     */
    function handle(
        uint32 _origin,
        bytes32 _sender,
        bytes calldata _body
    ) external payable override onlyMailbox {
        // Verify authorized sender for source domain
        bytes32 authorizedSender = authorizedSenders[_origin];
        if (authorizedSender == bytes32(0) || _sender != authorizedSender) {
            revert UnauthorizedSender();
        }

        (address borrower, uint8 score, uint256 timestamp) = abi.decode(_body, (address, uint8, uint256));

        // Replay protection
        bytes32 messageHash = keccak256(abi.encode(borrower, score, timestamp, _origin));
        if (processedMessages[messageHash]) {
            emit ReplayAttemptBlocked(messageHash);
            revert ReplayAttack();
        }
        processedMessages[messageHash] = true;

        // Validate score
        if (score > 100) revert InvalidRatingScore();

        // Reject stale data
        if (block.timestamp > timestamp + maxRatingAge) {
            emit StaleRatingRejected(borrower, timestamp, block.timestamp);
            revert StaleRating();
        }

        borrowerRatings[borrower] = Rating(score, timestamp, block.timestamp);
        emit RatingUpdated(borrower, score, timestamp, block.timestamp);
    }

    /**
     * @notice Get LTV for borrower based on credit rating
     * @return LTV percentage (e.g., 75 = 75%)
     */
    function getBorrowerLTV(address borrower) external view returns (uint256) {
        Rating memory rating = borrowerRatings[borrower];

        if (rating.timestamp == 0) return defaultLTV;
        if (block.timestamp > rating.timestamp + maxRatingAge) return defaultLTV;

        if (rating.score >= 80) return 75;
        if (rating.score >= 50) return 60;
        return 40;
    }

    function getBorrowerRating(address borrower)
        external
        view
        returns (uint8 score, uint256 timestamp, uint256 receivedAt, bool isValid)
    {
        Rating memory rating = borrowerRatings[borrower];
        score = rating.score;
        timestamp = rating.timestamp;
        receivedAt = rating.receivedAt;
        isValid = (timestamp != 0) && (block.timestamp <= timestamp + maxRatingAge);
    }

    // Admin functions
    function setAuthorizedSender(uint32 _sourceDomain, bytes32 _sender) external onlyOwner {
        authorizedSenders[_sourceDomain] = _sender;
        emit AuthorizedSenderUpdated(_sourceDomain, _sender);
    }

    function getAuthorizedSender(uint32 _sourceDomain) external view returns (bytes32) {
        return authorizedSenders[_sourceDomain];
    }

    function setMailbox(address _newMailbox) external onlyOwner {
        if (_newMailbox == address(0)) revert InvalidAddress();
        mailbox = _newMailbox;
        emit MailboxUpdated(_newMailbox);
    }

    function setMaxRatingAge(uint256 _newMaxAge) external onlyOwner {
        maxRatingAge = _newMaxAge;
        emit MaxRatingAgeUpdated(_newMaxAge);
    }

    function setDefaultLTV(uint256 _newDefaultLTV) external onlyOwner {
        require(_newDefaultLTV <= 100, "LTV cannot exceed 100%");
        defaultLTV = _newDefaultLTV;
        emit DefaultLTVUpdated(_newDefaultLTV);
    }

    // Helper functions
    function addressToBytes32(address _addr) public pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    function version() public pure returns (string memory) {
        return "1.0.0";
    }
}
