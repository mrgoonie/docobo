import {
  COLORS,
  createSetupEmbed,
  createSuccessEmbed,
  createErrorEmbed,
  createInfoEmbed,
  createWarningEmbed,
} from '../../../src/bot/utils/embeds.js';

describe('Embed Utilities', () => {
  describe('COLORS', () => {
    it('should have correct color values', () => {
      expect(COLORS.DOCOBO_BLUE).toBe(0x4a90e2);
      expect(COLORS.SUCCESS_GREEN).toBe(0x43b581);
      expect(COLORS.WARNING_AMBER).toBe(0xf0a020);
      expect(COLORS.ERROR_RED).toBe(0xf04747);
      expect(COLORS.INFO_PURPLE).toBe(0x7289da);
    });
  });

  describe('createSetupEmbed', () => {
    it('should create embed with correct progress', () => {
      const embed = createSetupEmbed(1, 3);
      const data = embed.toJSON();

      expect(data.color).toBe(COLORS.DOCOBO_BLUE);
      expect(data.footer?.text).toContain('Step 1/3');
      expect(data.footer?.text).toContain('33%');
    });

    it('should calculate progress correctly for step 2/3', () => {
      const embed = createSetupEmbed(2, 3);
      const data = embed.toJSON();

      expect(data.footer?.text).toContain('Step 2/3');
      expect(data.footer?.text).toContain('67%');
    });

    it('should show 100% for final step', () => {
      const embed = createSetupEmbed(3, 3);
      const data = embed.toJSON();

      expect(data.footer?.text).toContain('Step 3/3');
      expect(data.footer?.text).toContain('100%');
    });
  });

  describe('createSuccessEmbed', () => {
    it('should create success embed with title and description', () => {
      const embed = createSuccessEmbed('Test Title', 'Test Description');
      const data = embed.toJSON();

      expect(data.color).toBe(COLORS.SUCCESS_GREEN);
      expect(data.title).toContain('✅');
      expect(data.title).toContain('Test Title');
      expect(data.description).toBe('Test Description');
    });
  });

  describe('createErrorEmbed', () => {
    it('should create error embed with message', () => {
      const embed = createErrorEmbed('Something went wrong');
      const data = embed.toJSON();

      expect(data.color).toBe(COLORS.ERROR_RED);
      expect(data.title).toContain('❌');
      expect(data.description).toBe('Something went wrong');
    });
  });

  describe('createInfoEmbed', () => {
    it('should create info embed', () => {
      const embed = createInfoEmbed('Info Title', 'Info description');
      const data = embed.toJSON();

      expect(data.color).toBe(COLORS.INFO_PURPLE);
      expect(data.title).toBe('Info Title');
      expect(data.description).toBe('Info description');
    });
  });

  describe('createWarningEmbed', () => {
    it('should create warning embed with icon', () => {
      const embed = createWarningEmbed('Warning', 'Be careful');
      const data = embed.toJSON();

      expect(data.color).toBe(COLORS.WARNING_AMBER);
      expect(data.title).toContain('⚠️');
      expect(data.description).toBe('Be careful');
    });
  });
});
