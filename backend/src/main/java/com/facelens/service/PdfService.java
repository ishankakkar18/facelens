package com.facelens.service;

import org.openpdf.text.Document;
import org.openpdf.text.Font;
import org.openpdf.text.FontFactory;
import org.openpdf.text.PageSize;
import org.openpdf.text.Paragraph;
import org.openpdf.text.pdf.PdfWriter;
import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class PdfService {

    private static final Color BRAND = new Color(79, 70, 229);
    private static final Color HEADING = new Color(17, 24, 39);
    private static final Color BODY = new Color(55, 65, 81);
    private static final Color MUTED = new Color(107, 114, 128);

    public byte[] build(Map<String, Object> result, String dateLabel) {
        Document document = new Document(PageSize.A4, 50, 50, 50, 50);
        ByteArrayOutputStream output = new ByteArrayOutputStream();

        try {
            PdfWriter.getInstance(document, output);
            document.open();

            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA, 22, Font.BOLD, BRAND);
            Font subtitleFont = FontFactory.getFont(FontFactory.HELVETICA, 9, Font.NORMAL, MUTED);
            Font headingFont = FontFactory.getFont(FontFactory.HELVETICA, 13, Font.BOLD, HEADING);
            Font bodyFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Font.NORMAL, BODY);
            Font smallFont = FontFactory.getFont(FontFactory.HELVETICA, 8, Font.NORMAL, MUTED);

            document.add(new Paragraph("FaceLens Report", titleFont));
            document.add(new Paragraph("Generated " + dateLabel, subtitleFont));
            document.add(new Paragraph(" ", bodyFont));

            heading(document, "Overview", headingFont);
            paragraph(document, text(result, "overall_description"), bodyFont);

            addFact(document, "Estimated age range", text(result, "estimated_age_range"), bodyFont);
            addFact(document, "Facial shape", text(result, "facial_shape"), bodyFont);
            addFact(document, "Symmetry", text(result, "symmetry_notes"), bodyFont);
            addFact(document, "Photo quality", text(result, "photo_quality"), bodyFont);
            addFact(document, "Analysis confidence", text(result, "confidence"), bodyFont);

            Map<String, Object> skin = map(result, "skin");
            if (!skin.isEmpty()) {
                heading(document, "Skin", headingFont);
                addFact(document, "Tone", text(skin, "tone"), bodyFont);
                addFact(document, "Texture", text(skin, "texture"), bodyFont);
                List<?> concerns = list(skin, "concerns");
                if (!concerns.isEmpty()) {
                    paragraph(document, "Visible concerns:", bodyFont);
                    bullets(document, concerns, bodyFont);
                }
            }

            Map<String, Object> acne = map(skin, "acne");
            if (!acne.isEmpty()) {
                heading(document, "Acne (visible signs)", headingFont);
                addFact(document, "Severity", text(acne, "severity"), bodyFont);
                addFact(document, "Grade", text(acne, "grade"), bodyFont);
                addFact(document, "Scarring risk", text(acne, "scarring_risk"), bodyFont);
                addFact(document, "Inflammation", text(acne, "inflammation"), bodyFont);
                List<?> acneTypes = list(acne, "types");
                if (!acneTypes.isEmpty()) {
                    paragraph(document, "Types:", bodyFont);
                    bullets(document, acneTypes, bodyFont);
                }
                List<?> acneLocations = list(acne, "locations");
                if (!acneLocations.isEmpty()) {
                    paragraph(document, "Locations:", bodyFont);
                    bullets(document, acneLocations, bodyFont);
                }
            }

            Map<String, Object> acneMarks = map(skin, "acne_marks");
            if (!acneMarks.isEmpty()) {
                heading(document, "Acne marks", headingFont);
                addFact(document, "Type", text(acneMarks, "type"), bodyFont);
                addFact(document, "Severity", text(acneMarks, "severity"), bodyFont);
                addFact(document, "Note", text(acneMarks, "note"), bodyFont);
                List<?> markLocations = list(acneMarks, "locations");
                if (!markLocations.isEmpty()) {
                    paragraph(document, "Locations:", bodyFont);
                    bullets(document, markLocations, bodyFont);
                }
            }

            String clinical = text(result, "clinical_impression");
            if (clinical == null || clinical.isBlank()) {
                clinical = text(result, "medical_notes");
            }
            if (clinical != null && !clinical.isBlank()) {
                heading(document, "Clinical impression", headingFont);
                paragraph(document, clinical, bodyFont);
            }

            addFact(document, "Biggest issue", text(result, "biggest_issue"), bodyFont);
            addFact(document, "Biggest win", text(result, "biggest_win"), bodyFont);

            String reality = text(result, "reality_check");
            if (reality != null && !reality.isBlank()) {
                heading(document, "Reality check", headingFont);
                paragraph(document, reality, bodyFont);
            }

            Map<String, Object> features = map(result, "features");            if (!features.isEmpty()) {
                heading(document, "Features", headingFont);
                for (Map.Entry<String, Object> entry : features.entrySet()) {
                    if (entry.getValue() != null) {
                        addFact(document, capitalize(entry.getKey()), entry.getValue().toString(), bodyFont);
                    }
                }
            }

            Map<String, Object> routine = map(result, "routine");
            if (!routine.isEmpty()) {
                heading(document, "Personalized routine", headingFont);
                addListSection(document, "Morning", list(routine, "am"), headingFont, bodyFont);
                addListSection(document, "Evening", list(routine, "pm"), headingFont, bodyFont);
                addListSection(document, "Weekly", list(routine, "weekly"), headingFont, bodyFont);
                addListSection(document, "Avoid", list(routine, "avoid"), headingFont, bodyFont);

                Map<String, Object> timeline = map(routine, "timeline");
                if (!timeline.isEmpty()) {
                    heading(document, "Expected timeline", headingFont);
                    for (Map.Entry<String, Object> entry : timeline.entrySet()) {
                        if (entry.getValue() != null) {
                            addFact(document, capitalize(entry.getKey().replace("_", " ")),
                                    entry.getValue().toString(), bodyFont);
                        }
                    }
                }
            }

            addListSection(document, "Strengths", list(result, "strengths"), headingFont, bodyFont);
            addListSection(document, "Gentle focus areas", list(result, "areas_to_improve"), headingFont, bodyFont);

            Map<String, Object> suggestions = map(result, "suggestions");
            addListSection(document, "Skincare", list(suggestions, "skincare"), headingFont, bodyFont);
            addListSection(document, "What to use (ingredients)", list(suggestions, "ingredients"), headingFont, bodyFont);
            addListSection(document, "Grooming", list(suggestions, "grooming"), headingFont, bodyFont);
            addListSection(document, "Lifestyle", list(suggestions, "lifestyle"), headingFont, bodyFont);
            addListSection(document, "When to see a professional", list(suggestions, "professional"), headingFont, bodyFont);

            paragraph(document, " ", bodyFont);
            String disclaimer = text(result, "disclaimer");
            if (disclaimer == null || disclaimer.isBlank()) {
                disclaimer = "This is a general wellness analysis, not medical advice.";
            }
            paragraph(document, escape(disclaimer), smallFont);

            document.close();
        } catch (Exception exception) {
            throw new IllegalStateException("Could not generate PDF", exception);
        }

        return output.toByteArray();
    }

    private static void heading(Document document, String value, Font font) throws Exception {
        Paragraph paragraph = new Paragraph(value, font);
        paragraph.setSpacingBefore(14);
        paragraph.setSpacingAfter(6);
        document.add(paragraph);
    }

    private static void paragraph(Document document, String value, Font font) throws Exception {
        if (value == null || value.isBlank()) {
            return;
        }
        document.add(new Paragraph(escape(value), font));
    }

    private static void addFact(Document document, String label, String value, Font font) throws Exception {
        if (value == null || value.isBlank()) {
            return;
        }
        document.add(new Paragraph("<b>" + escape(label) + ":</b> " + escape(value), font));
    }

    private static void addListSection(
            Document document,
            String title,
            List<?> items,
            Font headingFont,
            Font bodyFont
    ) throws Exception {
        if (items == null || items.isEmpty()) {
            return;
        }
        heading(document, title, headingFont);
        bullets(document, items, bodyFont);
    }

    private static void bullets(Document document, List<?> items, Font font) throws Exception {
        for (Object item : items) {
            if (item != null && !item.toString().isBlank()) {
                Paragraph bullet = new Paragraph("• " + escape(item.toString()), font);
                bullet.setIndentationLeft(12);
                document.add(bullet);
            }
        }
    }

    private static String text(Map<String, Object> map, String key) {
        if (map == null) {
            return null;
        }
        Object value = map.get(key);
        return value == null ? null : value.toString();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Map<String, Object> source, String key) {
        if (source == null) {
            return Map.of();
        }
        Object value = source.get(key);
        if (value instanceof Map<?, ?>) {
            return (Map<String, Object>) value;
        }
        return Map.of();
    }

    private static List<?> list(Map<String, Object> source, String key) {
        if (source == null) {
            return List.of();
        }
        Object value = source.get(key);
        if (value instanceof List<?>) {
            return (List<?>) value;
        }
        return List.of();
    }

    private static String capitalize(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        return value.substring(0, 1).toUpperCase() + value.substring(1);
    }

    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
