import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import React from "react";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica" },
  title: { fontSize: 28, marginBottom: 16, fontWeight: 700 },
  subtitle: { fontSize: 14, color: "#444", marginBottom: 24 },
  block: { fontSize: 12, marginBottom: 8, color: "#222", lineHeight: 1.5 },
  footer: { marginTop: 32, fontSize: 10, color: "#888" },
});

export type LeafletInput = {
  neighbourhood: string;
  activityName: string;
  whenLabel: string;
  venue: string;
  body: string;
};

export async function renderLeafletPdf(input: LeafletInput): Promise<Buffer> {
  const doc = (
    <Document>
      <Page size="A5" style={styles.page}>
        <Text style={styles.title}>{input.activityName}</Text>
        <Text style={styles.subtitle}>
          {input.neighbourhood} · {input.whenLabel}
        </Text>
        <Text style={styles.block}>{input.body}</Text>
        <Text style={styles.block}>Locatie: {input.venue}</Text>
        <Text style={styles.footer}>Een initiatief van de gemeente. Vragen? Bel 14 010.</Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
