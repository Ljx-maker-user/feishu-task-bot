module.exports = (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'feishu-task-bot',
    version: '1.0.0',
  });
};
