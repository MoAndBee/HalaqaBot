import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';

export type Theme = 'gradient-elegance' | 'islamic-geometric';

export interface Participant {
  name: string;
  isDone: boolean;
  wasSkipped: boolean;
  activityLabel?: string;
}

export interface ListData {
  date: string;
  teacherName: string;
  supervisorName?: string;
  participants: Participant[];
  sessionNumber?: number;
}

export class ImageGeneratorService {
  private readonly width = 800;
  private readonly height = 1200;
  private fontsRegistered = false;

  constructor() {
    // Register Arabic fonts
    this.registerFonts();
  }

  private registerFonts() {
    if (this.fontsRegistered) return;

    try {
      // Register DejaVu Sans for Arabic support
      GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'DejaVuSans');
      GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'DejaVuSans-Bold');
      this.fontsRegistered = true;
      console.log('Arabic fonts registered successfully');
    } catch (error) {
      console.error('Failed to register fonts:', error);
    }
  }

  /**
   * Generate a beautiful image of the participant list
   */
  async generateListImage(data: ListData, theme: Theme = 'gradient-elegance'): Promise<Buffer> {
    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');

    // Draw theme-specific background
    if (theme === 'gradient-elegance') {
      this.drawGradientEleganceTheme(ctx, data);
    } else if (theme === 'islamic-geometric') {
      this.drawIslamicGeometricTheme(ctx, data);
    }

    return canvas.toBuffer('image/png');
  }

  /**
   * Theme 1: Gradient Elegance
   * Soft pink/purple gradient with white rounded cards
   */
  private drawGradientEleganceTheme(ctx: any, data: ListData) {
    // Background gradient (pink to light pink)
    const gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
    gradient.addColorStop(0, '#ffc9e0');
    gradient.addColorStop(0.5, '#ffe4f0');
    gradient.addColorStop(1, '#fff0f5');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    // Add subtle pattern overlay
    this.drawFloralPattern(ctx, 'rgba(255, 192, 203, 0.1)');

    let yPos = 60;

    // Title section with decorative elements
    this.drawDecorativeHeader(ctx, yPos, '#d946a6');
    yPos += 70;

    // Main title
    ctx.fillStyle = '#d946a6';
    ctx.font = 'bold 42px DejaVuSans';
    ctx.textAlign = 'center';
    ctx.fillText('🌸 أدوار صُوَيحِبات القرآن 🌸', this.width / 2, yPos);
    yPos += 60;

    // White info card with shadow
    const cardX = 80;
    const cardY = yPos;
    const cardWidth = this.width - 160;
    const cardHeight = 140;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    this.roundRect(ctx, cardX + 5, cardY + 5, cardWidth, cardHeight, 20, true, false);

    // Card
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    this.roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 20, true, false);

    // Info text
    ctx.fillStyle = '#4a5568';
    ctx.font = 'bold 28px DejaVuSans';
    ctx.textAlign = 'right';
    ctx.fillText(`📅 ${data.date}`, this.width - 120, cardY + 45);
    ctx.fillText(`👩‍🏫 المعلمة: ${data.teacherName}`, this.width - 120, cardY + 85);

    if (data.supervisorName) {
      ctx.fillText(`📋 المشرفة: ${data.supervisorName}`, this.width - 120, cardY + 125);
    }

    yPos += cardHeight + 50;

    // Participants section
    const completedParticipants = data.participants.filter(p => p.isDone);
    const activeParticipants = data.participants.filter(p => !p.isDone);

    // Completed section
    if (completedParticipants.length > 0) {
      yPos = this.drawParticipantSection(
        ctx,
        completedParticipants,
        yPos,
        'منجز ✅',
        '#10b981',
        'rgba(16, 185, 129, 0.1)',
        0
      );
    }

    // Active section
    if (activeParticipants.length > 0) {
      yPos = this.drawParticipantSection(
        ctx,
        activeParticipants,
        yPos,
        'جاري ⏳',
        '#f59e0b',
        'rgba(245, 158, 11, 0.1)',
        completedParticipants.length
      );
    }

    // Footer decoration
    this.drawFooterDecoration(ctx, this.height - 60, '#d946a6');
  }

  /**
   * Theme 3: Islamic Geometric
   * Geometric patterns with gold/teal colors
   */
  private drawIslamicGeometricTheme(ctx: any, data: ListData) {
    // Background: Deep teal gradient
    const gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
    gradient.addColorStop(0, '#0f4c5c');
    gradient.addColorStop(0.5, '#1a6b7c');
    gradient.addColorStop(1, '#0f4c5c');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    // Draw Islamic geometric pattern
    this.drawIslamicPattern(ctx);

    // Add ornamental border
    this.drawOrnamentalBorder(ctx, '#d4af37');

    let yPos = 80;

    // Ornamental header
    this.drawIslamicHeader(ctx, yPos, '#d4af37');
    yPos += 70;

    // Main title
    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 44px DejaVuSans';
    ctx.textAlign = 'center';
    ctx.fillText('أدوار صُوَيحِبات القرآن', this.width / 2, yPos);

    // Decorative line
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(200, yPos + 15);
    ctx.lineTo(this.width - 200, yPos + 15);
    ctx.stroke();

    yPos += 70;

    // Info card with golden border
    const cardX = 100;
    const cardY = yPos;
    const cardWidth = this.width - 200;
    const cardHeight = 140;

    // Golden border
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    this.roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 15, false, true);

    // Semi-transparent fill
    ctx.fillStyle = 'rgba(15, 76, 92, 0.8)';
    this.roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 15, true, false);

    // Info text in gold
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 26px DejaVuSans';
    ctx.textAlign = 'right';
    ctx.fillText(`📅 ${data.date}`, this.width - 140, cardY + 45);
    ctx.fillText(`👩‍🏫 المعلمة: ${data.teacherName}`, this.width - 140, cardY + 85);

    if (data.supervisorName) {
      ctx.fillText(`📋 المشرفة: ${data.supervisorName}`, this.width - 140, cardY + 125);
    }

    yPos += cardHeight + 60;

    // Participants
    const completedParticipants = data.participants.filter(p => p.isDone);
    const activeParticipants = data.participants.filter(p => !p.isDone);

    // Completed section
    if (completedParticipants.length > 0) {
      yPos = this.drawIslamicParticipantSection(
        ctx,
        completedParticipants,
        yPos,
        'منجز ✅',
        '#10b981',
        0
      );
    }

    // Active section
    if (activeParticipants.length > 0) {
      yPos = this.drawIslamicParticipantSection(
        ctx,
        activeParticipants,
        yPos,
        'جاري ⏳',
        '#f59e0b',
        completedParticipants.length
      );
    }

    // Footer with Islamic pattern
    this.drawIslamicFooter(ctx, this.height - 70, '#d4af37');
  }

  /**
   * Draw participant section for gradient theme
   */
  private drawParticipantSection(
    ctx: any,
    participants: Participant[],
    startY: number,
    title: string,
    color: string,
    bgColor: string,
    startIndex: number
  ): number {
    let yPos = startY;

    // Section header
    ctx.fillStyle = color;
    ctx.font = 'bold 32px DejaVuSans';
    ctx.textAlign = 'right';
    ctx.fillText(title, this.width - 100, yPos);
    yPos += 50;

    // Participants
    participants.forEach((participant, index) => {
      const cardX = 60;
      const cardWidth = this.width - 120;
      const cardHeight = 70;

      // Card shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      this.roundRect(ctx, cardX + 3, yPos + 3, cardWidth, cardHeight, 15, true, false);

      // Card with subtle background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      this.roundRect(ctx, cardX, yPos, cardWidth, cardHeight, 15, true, false);

      // Accent border
      ctx.strokeStyle = bgColor;
      ctx.lineWidth = 4;
      this.roundRect(ctx, cardX, yPos, cardWidth, cardHeight, 15, false, true);

      // Participant info
      ctx.fillStyle = '#2d3748';
      ctx.font = 'bold 26px DejaVuSans';
      ctx.textAlign = 'right';

      const arabicNumber = (startIndex + index + 1).toLocaleString('ar-EG');
      const name = participant.name;
      const skipLabel = participant.wasSkipped && !participant.isDone ? ' 🗣️' : '';
      const activityLabel = participant.activityLabel || '';

      ctx.fillText(
        `🌸 ${arabicNumber}. ${name}${activityLabel}${skipLabel}`,
        this.width - 90,
        yPos + 45
      );

      yPos += cardHeight + 15;
    });

    return yPos + 20;
  }

  /**
   * Draw participant section for Islamic theme
   */
  private drawIslamicParticipantSection(
    ctx: any,
    participants: Participant[],
    startY: number,
    title: string,
    color: string,
    startIndex: number
  ): number {
    let yPos = startY;

    // Section header with ornament
    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 32px DejaVuSans';
    ctx.textAlign = 'center';
    ctx.fillText(title, this.width / 2, yPos);

    // Decorative underline
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.width / 2 - 100, yPos + 10);
    ctx.lineTo(this.width / 2 + 100, yPos + 10);
    ctx.stroke();

    yPos += 50;

    // Participants
    participants.forEach((participant, index) => {
      const cardX = 80;
      const cardWidth = this.width - 160;
      const cardHeight = 65;

      // Card with golden border
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 2;
      this.roundRect(ctx, cardX, yPos, cardWidth, cardHeight, 10, false, true);

      // Semi-transparent fill
      ctx.fillStyle = 'rgba(212, 175, 55, 0.15)';
      this.roundRect(ctx, cardX, yPos, cardWidth, cardHeight, 10, true, false);

      // Participant info in light color
      ctx.fillStyle = '#f0f0f0';
      ctx.font = 'bold 24px DejaVuSans';
      ctx.textAlign = 'right';

      const arabicNumber = (startIndex + index + 1).toLocaleString('ar-EG');
      const name = participant.name;
      const skipLabel = participant.wasSkipped && !participant.isDone ? ' 🗣️' : '';
      const activityLabel = participant.activityLabel || '';

      ctx.fillText(
        `⭐ ${arabicNumber}. ${name}${activityLabel}${skipLabel}`,
        this.width - 110,
        yPos + 42
      );

      yPos += cardHeight + 15;
    });

    return yPos + 30;
  }

  /**
   * Helper: Draw rounded rectangle
   */
  private roundRect(
    ctx: any,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fill: boolean,
    stroke: boolean
  ) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  /**
   * Draw floral pattern overlay
   */
  private drawFloralPattern(ctx: any, color: string) {
    ctx.fillStyle = color;

    // Simple flower pattern
    for (let x = 0; x < this.width; x += 100) {
      for (let y = 0; y < this.height; y += 100) {
        // Small decorative circles
        ctx.beginPath();
        ctx.arc(x + 25, y + 25, 15, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x + 75, y + 75, 12, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * Draw Islamic geometric pattern
   */
  private drawIslamicPattern(ctx: any) {
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.1)';
    ctx.lineWidth = 2;

    // Create geometric star pattern
    const spacing = 80;
    for (let x = 0; x < this.width; x += spacing) {
      for (let y = 0; y < this.height; y += spacing) {
        this.drawStar(ctx, x + spacing / 2, y + spacing / 2, 8, 30, 15);
      }
    }
  }

  /**
   * Draw a star shape
   */
  private drawStar(ctx: any, cx: number, cy: number, points: number, outer: number, inner: number) {
    ctx.beginPath();

    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.closePath();
    ctx.stroke();
  }

  /**
   * Draw decorative header for gradient theme
   */
  private drawDecorativeHeader(ctx: any, y: number, color: string) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;

    // Decorative lines
    ctx.beginPath();
    ctx.moveTo(100, y);
    ctx.lineTo(this.width - 100, y);
    ctx.stroke();
  }

  /**
   * Draw Islamic ornamental header
   */
  private drawIslamicHeader(ctx: any, y: number, color: string) {
    ctx.fillStyle = color;

    // Central ornament
    const centerX = this.width / 2;

    // Draw decorative diamond
    ctx.beginPath();
    ctx.moveTo(centerX, y - 20);
    ctx.lineTo(centerX + 30, y);
    ctx.lineTo(centerX, y + 20);
    ctx.lineTo(centerX - 30, y);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Draw footer decoration
   */
  private drawFooterDecoration(ctx: any, y: number, color: string) {
    ctx.fillStyle = color;
    ctx.font = '24px DejaVuSans';
    ctx.textAlign = 'center';
    ctx.fillText('🌸 ━━━━━━━━━━━━━━━━━━ 🌸', this.width / 2, y);
  }

  /**
   * Draw Islamic footer
   */
  private drawIslamicFooter(ctx: any, y: number, color: string) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    // Ornamental lines
    ctx.beginPath();
    ctx.moveTo(150, y);
    ctx.lineTo(this.width - 150, y);
    ctx.stroke();

    // Central ornament
    const centerX = this.width / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(centerX, y, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw ornamental border
   */
  private drawOrnamentalBorder(ctx: any, color: string) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;

    const margin = 20;

    // Outer border
    this.roundRect(
      ctx,
      margin,
      margin,
      this.width - margin * 2,
      this.height - margin * 2,
      20,
      false,
      true
    );

    // Inner decorative border
    ctx.lineWidth = 2;
    this.roundRect(
      ctx,
      margin + 10,
      margin + 10,
      this.width - (margin + 10) * 2,
      this.height - (margin + 10) * 2,
      15,
      false,
      true
    );
  }
}
