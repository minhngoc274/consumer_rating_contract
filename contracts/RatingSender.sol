// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./interfaces/IMailbox.sol";

contract RatingSender is Initializable, OwnableUpgradeable {

    // State Variables
    IMailbox public mailbox;
    mapping(uint32 => bytes32) public destinationRecipients;  // destinationDomain => recipient
    mapping(address => bool) public authorizedRaters;
    uint256 public totalRatingsSent;

    // Events
    event RatingSent(address indexed borrower, uint8 score, uint256 timestamp, bytes32 messageId);
    event RaterAuthorized(address indexed rater);
    event RaterRevoked(address indexed rater);
    event DestinationRecipientUpdated(uint32 indexed destinationDomain, bytes32 indexed recipient);
    event MailboxUpdated(address indexed newMailbox);

    // Errors
    error Unauthorized();
    error InvalidRatingScore();
    error InvalidAddress();

    modifier onlyAuthorizedRater() {
        if (!authorizedRaters[msg.sender]) revert Unauthorized();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _mailbox) public initializer {
        if (_mailbox == address(0)) revert InvalidAddress();
        __Ownable_init(msg.sender);

        mailbox = IMailbox(_mailbox);
        authorizedRaters[msg.sender] = true;
        emit RaterAuthorized(msg.sender);
    }

    /**
     * @notice Send rating to destination chain
     * @param destinationDomain Target chain domain ID
     * @param borrower Borrower address
     * @param score Credit score (0-100)
     */
    function sendRating(uint32 destinationDomain, address borrower, uint8 score)
        external
        payable
        onlyAuthorizedRater
    {
        if (score > 100) revert InvalidRatingScore();

        bytes32 recipient = destinationRecipients[destinationDomain];
        if (recipient == bytes32(0)) revert InvalidAddress();

        bytes memory messageBody = abi.encode(borrower, score, block.timestamp);
        bytes32 messageId = mailbox.dispatch{value: msg.value}(destinationDomain, recipient, messageBody);

        totalRatingsSent++;
        emit RatingSent(borrower, score, block.timestamp, messageId);
    }

    /**
     * @notice Batch send ratings to destination chain
     */
    function sendRatingBatch(
        uint32 destinationDomain,
        address[] calldata borrowers,
        uint8[] calldata scores
    ) external payable onlyAuthorizedRater {
        require(borrowers.length == scores.length, "Array length mismatch");
        require(borrowers.length > 0, "Empty arrays");

        bytes32 recipient = destinationRecipients[destinationDomain];
        if (recipient == bytes32(0)) revert InvalidAddress();

        uint256 gasPerMessage = msg.value / borrowers.length;
        uint256 timestamp = block.timestamp;

        for (uint256 i = 0; i < borrowers.length; i++) {
            if (scores[i] > 100) revert InvalidRatingScore();

            bytes memory messageBody = abi.encode(borrowers[i], scores[i], timestamp);
            bytes32 messageId = mailbox.dispatch{value: gasPerMessage}(destinationDomain, recipient, messageBody);

            emit RatingSent(borrowers[i], scores[i], timestamp, messageId);
        }

        totalRatingsSent += borrowers.length;
    }

    // Admin functions
    function authorizeRater(address rater) external onlyOwner {
        authorizedRaters[rater] = true;
        emit RaterAuthorized(rater);
    }

    function revokeRater(address rater) external onlyOwner {
        authorizedRaters[rater] = false;
        emit RaterRevoked(rater);
    }

    function setDestinationRecipient(uint32 _destinationDomain, bytes32 _recipient) external onlyOwner {
        destinationRecipients[_destinationDomain] = _recipient;
        emit DestinationRecipientUpdated(_destinationDomain, _recipient);
    }

    function getDestinationRecipient(uint32 _destinationDomain) external view returns (bytes32) {
        return destinationRecipients[_destinationDomain];
    }

    function setMailbox(address _newMailbox) external onlyOwner {
        if (_newMailbox == address(0)) revert InvalidAddress();
        mailbox = IMailbox(_newMailbox);
        emit MailboxUpdated(_newMailbox);
    }

    // Helper functions
    function addressToBytes32(address _addr) public pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    function bytes32ToAddress(bytes32 _buf) public pure returns (address) {
        return address(uint160(uint256(_buf)));
    }

    /**
     * @notice Quote gas payment for sending a rating to destination chain
     * @param destinationDomain Target chain domain ID
     * @param borrower Borrower address
     * @param score Credit score
     * @return fee Estimated gas fee in native token
     */
    function quoteGasPayment(
        uint32 destinationDomain,
        address borrower,
        uint8 score
    ) external view returns (uint256 fee) {
        bytes32 recipient = destinationRecipients[destinationDomain];
        if (recipient == bytes32(0)) revert InvalidAddress();

        bytes memory messageBody = abi.encode(borrower, score, block.timestamp);
        return mailbox.quoteDispatch(destinationDomain, recipient, messageBody);
    }

    /**
     * @notice Quote total gas payment for batch rating send
     * @param destinationDomain Target chain domain ID
     * @param borrowers Array of borrower addresses
     * @param scores Array of credit scores
     * @return totalFee Total estimated gas fee for all messages
     */
    function quoteGasPaymentBatch(
        uint32 destinationDomain,
        address[] calldata borrowers,
        uint8[] calldata scores
    ) external view returns (uint256 totalFee) {
        require(borrowers.length == scores.length, "Array length mismatch");
        require(borrowers.length > 0, "Empty arrays");

        bytes32 recipient = destinationRecipients[destinationDomain];
        if (recipient == bytes32(0)) revert InvalidAddress();

        uint256 timestamp = block.timestamp;

        for (uint256 i = 0; i < borrowers.length; i++) {
            bytes memory messageBody = abi.encode(borrowers[i], scores[i], timestamp);
            totalFee += mailbox.quoteDispatch(destinationDomain, recipient, messageBody);
        }
    }

    function version() public pure returns (string memory) {
        return "1.0.0";
    }

    receive() external payable {}
}
