import { Request, Response } from "express";
import { datasetService } from "../services/dataset.service";
import { logger } from "../utils/logger";

export async function getDatasetStatistics(_req: Request, res: Response): Promise<void> {
  try {
    const stats = await datasetService.getStatistics();
    res.status(200).json(stats);
  } catch (err) {
    logger.error(`getDatasetStatistics error: ${err}`);
    res.status(500).json({ error: "Failed to fetch dataset statistics" });
  }
}

export async function getDatasetSamples(req: Request, res: Response): Promise<void> {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const samples = await datasetService.getSamples(status);
    res.status(200).json({ samples, count: samples.length });
  } catch (err) {
    logger.error(`getDatasetSamples error: ${err}`);
    res.status(500).json({ error: "Failed to fetch dataset samples" });
  }
}

export async function getDatasetSampleById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const data = await datasetService.getSampleById(id);
    if (!data.sample) {
      res.status(404).json({ error: `Sample ${id} not found` });
      return;
    }
    res.status(200).json(data);
  } catch (err) {
    logger.error(`getDatasetSampleById error: ${err}`);
    res.status(500).json({ error: "Failed to fetch sample details" });
  }
}

export async function submitDatasetReview(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body;
    const review = await datasetService.submitReview(id, body);
    res.status(200).json({ success: true, review });
  } catch (err: any) {
    logger.error(`submitDatasetReview error: ${err}`);
    res.status(400).json({ error: err.message || "Failed to submit review" });
  }
}

export async function qualityCheckSample(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const sample = await datasetService.qualityCheckSample(id);
    res.status(200).json({ success: true, sample });
  } catch (err: any) {
    logger.error(`qualityCheckSample error: ${err}`);
    res.status(400).json({ error: err.message || "Failed to quality check sample" });
  }
}

export async function excludeDatasetSample(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const sample = await datasetService.excludeSample(id, reason || "manual_exclusion");
    res.status(200).json({ success: true, sample });
  } catch (err: any) {
    logger.error(`excludeDatasetSample error: ${err}`);
    res.status(400).json({ error: err.message || "Failed to exclude sample" });
  }
}

export async function exportDataset(req: Request, res: Response): Promise<void> {
  try {
    const format = req.query.format === "csv" ? "csv" : "jsonl";
    const onlyIncluded = req.query.onlyIncluded === "true";

    if (format === "csv") {
      const csv = datasetService.exportCSV(onlyIncluded);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="vira_dataset_${Date.now()}.csv"`);
      res.status(200).send(csv);
    } else {
      const jsonl = datasetService.exportJSONL(onlyIncluded);
      res.setHeader("Content-Type", "application/jsonl");
      res.setHeader("Content-Disposition", `attachment; filename="vira_dataset_${Date.now()}.jsonl"`);
      res.status(200).send(jsonl);
    }
  } catch (err) {
    logger.error(`exportDataset error: ${err}`);
    res.status(500).json({ error: "Failed to export dataset" });
  }
}
