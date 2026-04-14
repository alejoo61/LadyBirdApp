class MenuItemController {
  constructor(menuItemRepository) {
    this.repo = menuItemRepository;
  }

  async getAll(req, res) {
    try {
      const { category, eventType, isActive } = req.query;
      const items = await this.repo.findAll({
        category,
        eventType,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
      });
      res.json({ success: true, data: items, count: items.length });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getByEventType(req, res) {
    try {
      const items = await this.repo.findByEventType(req.params.eventType);
      res.json({ success: true, data: items, count: items.length });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async create(req, res) {
    try {
      const item = await this.repo.create(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async update(req, res) {
    try {
      const item = await this.repo.update(req.params.id, req.body);
      if (!item) return res.status(404).json({ success: false, error: 'Item not found' });
      res.json({ success: true, data: item });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async delete(req, res) {
    try {
      const deleted = await this.repo.delete(req.params.id);
      if (!deleted) return res.status(404).json({ success: false, error: 'Item not found' });
      res.json({ success: true, message: 'Item deleted' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = MenuItemController;