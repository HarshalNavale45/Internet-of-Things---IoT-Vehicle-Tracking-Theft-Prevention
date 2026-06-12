import os
import csv
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def generate_pdf_report(csv_path, pdf_path):
    """
    Generates a professional corporate PDF report based on logged GPS tracking telemetry.
    """
    if not os.path.exists(csv_path):
        return False, "CSV log file does not exist. Please generate some simulation logs first."

    # Parse CSV logs
    logs = []
    total_records = 0
    total_speed = 0.0
    max_speed = 0.0
    breaches_count = 0
    theft_count = 0
    locked_count = 0

    try:
        with open(csv_path, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                logs.append(row)
                total_records += 1
                try:
                    speed = float(row.get('speed', 0.0))
                    total_speed += speed
                    if speed > max_speed:
                        max_speed = speed
                except ValueError:
                    pass

                if row.get('geofence_breached') == 'True':
                    breaches_count += 1
                if row.get('vibration_alert') == 'True':
                    theft_count += 1
                if row.get('engine_locked') == 'True':
                    locked_count += 1
    except Exception as e:
        return False, f"Failed to parse CSV: {str(e)}"

    if total_records == 0:
        return False, "No tracking records found in CSV."

    # Calculated metrics
    avg_speed = round(total_speed / total_records, 2)
    latest_status = logs[-1].get('status', 'Unknown')
    report_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Document setup
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    
    # Custom color palette (Dark Slate Primary, Soft Silver backgrounds, Alert accents)
    primary_color = colors.HexColor("#0f172a")
    secondary_color = colors.HexColor("#0284c7")
    accent_red = colors.HexColor("#ef4444")
    accent_green = colors.HexColor("#22c55e")
    bg_light = colors.HexColor("#f8fafc")
    border_color = colors.HexColor("#cbd5e1")

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        textColor=primary_color,
        spaceAfter=15
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        textColor=secondary_color,
        spaceAfter=20
    )

    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        textColor=primary_color,
        spaceAfter=10,
        spaceBefore=15
    )

    cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        textColor=primary_color
    )
    
    cell_style_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        textColor=primary_color
    )

    cell_style_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=colors.white
    )

    story = []

    # Title Banner
    story.append(Paragraph("IoT Vehicle Tracking & Theft Prevention System", title_style))
    story.append(Paragraph(f"Telemetry Analysis & Location History Log Report — Generated on {report_date}", subtitle_style))
    story.append(Spacer(1, 10))

    # Summary Panel (Metrics Grid)
    summary_data = [
        [
            Paragraph("<b>Total Log Points:</b>", cell_style), Paragraph(str(total_records), cell_style),
            Paragraph("<b>Max Speed Tracked:</b>", cell_style), Paragraph(f"{max_speed} km/h", cell_style)
        ],
        [
            Paragraph("<b>Average Speed:</b>", cell_style), Paragraph(f"{avg_speed} km/h", cell_style),
            Paragraph("<b>Geofence Violations:</b>", cell_style), Paragraph(str(breaches_count), cell_style)
        ],
        [
            Paragraph("<b>Vibration (Theft) Triggers:</b>", cell_style), Paragraph(str(theft_count), cell_style),
            Paragraph("<b>Engine Lock Trigger Count:</b>", cell_style), Paragraph(str(locked_count), cell_style)
        ],
        [
            Paragraph("<b>Latest Vehicle Status:</b>", cell_style_bold), Paragraph(latest_status, cell_style_bold),
            Paragraph("<b>Log Period Finish:</b>", cell_style), Paragraph(logs[-1].get('timestamp', 'N/A'), cell_style)
        ]
    ]

    summary_table = Table(summary_data, colWidths=[130, 130, 130, 130])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg_light),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
        ('BOX', (0,0), (-1,-1), 1, primary_color),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
    ]))
    
    story.append(Paragraph("System Telemetry Summary", section_heading))
    story.append(summary_table)
    story.append(Spacer(1, 15))

    # Detailed Log Table
    table_header = [
        Paragraph("Timestamp", cell_style_header),
        Paragraph("Latitude", cell_style_header),
        Paragraph("Longitude", cell_style_header),
        Paragraph("Speed (km/h)", cell_style_header),
        Paragraph("Status", cell_style_header),
        Paragraph("Alerts Active", cell_style_header)
    ]
    
    table_rows = [table_header]

    # Display up to the latest 30 rows in the PDF to fit cleanly on pages
    max_display_rows = 30
    display_logs = logs[-max_display_rows:]

    for log in display_logs:
        alerts = []
        if log.get('geofence_breached') == 'True':
            alerts.append("Geofence Breach")
        if log.get('vibration_alert') == 'True':
            alerts.append("Theft Alert")
        if log.get('engine_locked') == 'True':
            alerts.append("Engine Lock")
            
        alert_str = ", ".join(alerts) if alerts else "None"
        
        status_text = log.get('status', 'Unknown')
        status_color = primary_color
        if status_text == 'Stolen':
            status_color = accent_red
        elif status_text == 'Geofence Breach':
            status_color = accent_red
        elif status_text == 'Driving':
            status_color = secondary_color
        elif status_text == 'Parked':
            status_color = accent_green

        cell_status_style = ParagraphStyle(
            'CellStatus',
            parent=cell_style,
            textColor=status_color,
            fontName='Helvetica-Bold'
        )

        row = [
            Paragraph(log.get('timestamp', 'N/A'), cell_style),
            Paragraph(log.get('latitude', '0.0'), cell_style),
            Paragraph(log.get('longitude', '0.0'), cell_style),
            Paragraph(log.get('speed', '0.0'), cell_style),
            Paragraph(status_text, cell_status_style),
            Paragraph(alert_str, ParagraphStyle('CellAlert', parent=cell_style, textColor=accent_red if alert_str != "None" else primary_color))
        ]
        table_rows.append(row)

    log_table = Table(table_rows, colWidths=[110, 80, 80, 75, 75, 110])
    
    # Generate alternating row colors
    table_styles = [
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
        ('BOX', (0,0), (-1,-1), 1, primary_color)
    ]
    
    for i in range(1, len(table_rows)):
        if i % 2 == 0:
            table_styles.append(('BACKGROUND', (0, i), (-1, i), bg_light))
            
    log_table.setStyle(TableStyle(table_styles))
    
    story.append(Paragraph(f"Detailed Telemetry Logs (Showing last {len(display_logs)} updates)", section_heading))
    story.append(log_table)

    # Footer note
    story.append(Spacer(1, 20))
    story.append(Paragraph("<i>Note: This document is an automated telemetry export file generated by the IoT Vehicle Tracking Platform. All tracking coordinates are processed dynamically using satellites and cellular networks.</i>", cell_style))

    # Build the document
    try:
        doc.build(story)
        return True, "PDF Report successfully compiled in outputs/reports/!"
    except Exception as e:
        return False, f"Error compiling document: {str(e)}"
