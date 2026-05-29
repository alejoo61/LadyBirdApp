// src/services/EmailService.js
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.gmail.com',
      port:   parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async send({ to, subject, text, html }) {
    const recipients = Array.isArray(to) ? to.join(', ') : to;
    await this.transporter.sendMail({
      from:    process.env.SMTP_FROM || process.env.SMTP_USER,
      to:      recipients,
      subject,
      text,
      html,
    });
  }

  async sendPasswordReset(email, resetUrl) {
    await this.send({
      to:      email,
      subject: 'LadyBird — Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #c0392b;">LadyBird Taco — Password Reset</h2>
          <p>You requested a password reset. Click the button below to set a new password.</p>
          <p>This link expires in <strong>1 hour</strong>.</p>
          <a href="${resetUrl}" style="
            display: inline-block;
            margin: 20px 0;
            padding: 12px 24px;
            background: #c0392b;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
          ">Reset Password</a>
          <p style="color: #999; font-size: 12px;">
            If you did not request this, ignore this email. Your password will not change.
          </p>
          <p style="color: #999; font-size: 12px;">
            Or copy this link: ${resetUrl}
          </p>
        </div>
      `,
      text: `LadyBird Password Reset\n\nClick this link to reset your password (expires in 1 hour):\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
    });
  }

  async sendKitchenFinishAlert(order, errorMessage) {
    await this.send({
      to:      ['catering@ladybirdtaco.com', 'alejandro@ladybirdtaco.com', 'katia@ladybirdtaco.com'],
      subject: `⚠️ Kitchen Finish Time failed — Order #${order.displayNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #c0392b;">⚠️ Kitchen Finish Time — Calculation Failed</h2>
          <p>Could not calculate Kitchen Finish Time for the following order:</p>
          <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
            <tr><td style="padding: 6px; font-weight: bold;">Order #</td><td style="padding: 6px;">${order.displayNumber}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Client</td><td style="padding: 6px;">${order.clientName || '—'}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Address</td><td style="padding: 6px;">${order.deliveryAddress || '—'}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Error</td><td style="padding: 6px; color: #c0392b;">${errorMessage}</td></tr>
          </table>
          <p>Please calculate the Kitchen Finish Time manually for this order.</p>
        </div>
      `,
      text: `Kitchen Finish Time failed for Order #${order.displayNumber} (${order.clientName})\nAddress: ${order.deliveryAddress}\nError: ${errorMessage}\n\nPlease calculate manually.`,
    });
  }
}

module.exports = EmailService;