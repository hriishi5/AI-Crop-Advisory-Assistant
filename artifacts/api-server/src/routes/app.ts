import { Router, type IRouter, type RequestHandler } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import bcrypt from "bcryptjs";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import {
  ArchiveFarmParams,
  CreateAdvisoryBody,
  CreateAdvisoryParams,
  CreateAdvisoryResponse,
  CreateDiagnosticBody,
  CreateDiagnosticParams,
  CreateDiagnosticResponse,
  CreateFarmBody,
  CreateFarmResponse,
  CreateFarmResponse as FarmResponse,
  GetAdvisoryParams,
  GetAdvisoryResponse,
  GetCurrentFarmerResponse,
  GetDashboardSummaryResponse,
  GetDiagnosticParams,
  GetDiagnosticResponse,
  GetFarmParams,
  GetFarmResponse,
  GetHistoryQueryParams,
  GetHistoryResponse,
  ListFarmAdvisoriesParams,
  ListFarmAdvisoriesResponse,
  ListFarmDiagnosticsParams,
  ListFarmDiagnosticsResponse,
  ListFarmsResponse,
  LoginBody,
  LoginResponse,
  LogoutResponse,
  RegisterBody,
  RegisterResponse,
  ResolveDiagnosticParams,
  ResolveDiagnosticResponse,
  UpdateFarmBody,
  UpdateFarmParams,
  UpdateFarmResponse,
  UpdateProfileBody,
  UpdateProfileResponse,
} from "@workspace/api-zod";
import { cropAdvisories, db, farms, farmers, pestDiagnostics } from "@workspace/db";
import { AIServiceError, generateAdvisory, generateDiagnostic } from "../services/ai";
import {
  authenticate,
  clearSessionCookie,
  handleRouteError,
  requireFarmer,
  setSessionCookie,
} from "../lib/auth";

const router: IRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.AI_RATE_LIMIT_PER_HOUR ?? 10),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.farmerId ?? ipKeyGenerator(req.ip ?? "unknown"),
  message: { error: "You have reached the advisory limit for this hour." },
});

function asyncRoute(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function parseId(value: unknown): string {
  return String(value);
}

function numeric(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function farmerDto(farmer: typeof farmers.$inferSelect) {
  return GetCurrentFarmerResponse.parse({
    id: farmer.id,
    fullName: farmer.fullName,
    email: farmer.email,
    phone: farmer.phone,
    primaryLanguage: farmer.primaryLanguage,
    defaultState: farmer.defaultState,
    defaultDistrict: farmer.defaultDistrict,
  });
}

function farmDto(farm: typeof farms.$inferSelect) {
  return FarmResponse.parse({
    id: farm.id,
    name: farm.name,
    village: farm.village,
    district: farm.district,
    state: farm.state,
    gpsLat: numeric(farm.gpsLat),
    gpsLng: numeric(farm.gpsLng),
    soilType: farm.soilType,
    areaAcres: numeric(farm.areaAcres) ?? 0,
    primaryIrrigation: farm.primaryIrrigation,
    isArchived: farm.isArchived,
    createdAt: farm.createdAt,
  });
}

function advisoryDto(
  advisory: typeof cropAdvisories.$inferSelect,
  farmName: string,
) {
  return CreateAdvisoryResponse.parse({
    id: advisory.id,
    farmId: advisory.farmId,
    farmName,
    season: advisory.season,
    soilTypeUsed: advisory.soilTypeUsed,
    landAreaAcresUsed: numeric(advisory.landAreaAcresUsed) ?? 0,
    irrigationUsed: advisory.irrigationUsed,
    budgetTier: advisory.budgetTier,
    previousCrop: advisory.previousCrop,
    knownSoilIssues: advisory.knownSoilIssues ?? [],
    farmerGoal: advisory.farmerGoal,
    recommendedCrops: advisory.recommendedCrops,
    fertilizerPlan: advisory.fertilizerPlan,
    irrigationPlan: advisory.irrigationPlan,
    riskFactors: advisory.riskFactors,
    confidenceScore: numeric(advisory.confidenceScore) ?? 0,
    modelVersion: advisory.modelVersion,
    createdAt: advisory.createdAt,
  });
}

function diagnosticDto(
  diagnostic: typeof pestDiagnostics.$inferSelect,
  farmName: string,
) {
  return CreateDiagnosticResponse.parse({
    id: diagnostic.id,
    farmId: diagnostic.farmId,
    farmName,
    affectedCrop: diagnostic.affectedCrop,
    growthStage: diagnostic.growthStage,
    symptomCategory: diagnostic.symptomCategory,
    symptomDescription: diagnostic.symptomDescription,
    affectedPlantPart: diagnostic.affectedPlantPart ?? [],
    daysSinceSymptomsAppeared: numeric(diagnostic.daysSinceSymptomsAppeared),
    weatherRecent: diagnostic.weatherRecent,
    likelyDiagnosis: diagnostic.likelyDiagnosis,
    confidenceScore: numeric(diagnostic.confidenceScore) ?? 0,
    possibleCauses: diagnostic.possibleCauses,
    treatmentPlan: diagnostic.treatmentPlan,
    preventionTips: diagnostic.preventionTips,
    isResolved: diagnostic.isResolved,
    modelVersion: diagnostic.modelVersion,
    createdAt: diagnostic.createdAt,
  });
}

async function ownedFarm(farmId: string, farmerId: string, includeArchived = false) {
  const rows = await db
    .select()
    .from(farms)
    .where(
      and(
        eq(farms.id, farmId),
        eq(farms.farmerId, farmerId),
        includeArchived ? undefined : eq(farms.isArchived, false),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

router.post(
  "/auth/register",
  asyncRoute(async (req, res) => {
    const body = RegisterBody.parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, 12);
    const [farmer] = await db
      .insert(farmers)
      .values({
        fullName: body.fullName,
        email: body.email.toLowerCase(),
        passwordHash,
        phone: body.phone,
      })
      .returning();
    setSessionCookie(res, farmer.id);
    res.status(201).json(RegisterResponse.parse(farmerDto(farmer)));
  }),
);

router.post(
  "/auth/login",
  loginLimiter,
  asyncRoute(async (req, res) => {
    const body = LoginBody.parse(req.body);
    const rows = await db
      .select()
      .from(farmers)
      .where(eq(farmers.email, body.email.toLowerCase()))
      .limit(1);
    const farmer = rows[0];
    if (!farmer || !(await bcrypt.compare(body.password, farmer.passwordHash))) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }
    setSessionCookie(res, farmer.id);
    res.json(LoginResponse.parse(farmerDto(farmer)));
  }),
);

router.post(
  "/auth/logout",
  authenticate,
  asyncRoute(async (_req, res) => {
    clearSessionCookie(res);
    res.json(LogoutResponse.parse({ message: "Logged out." }));
  }),
);

router.get(
  "/auth/me",
  authenticate,
  asyncRoute(async (req, res) => {
    const farmerId = requireFarmer(req, res);
    if (!farmerId) return;
    const [farmer] = await db.select().from(farmers).where(eq(farmers.id, farmerId)).limit(1);
    if (!farmer) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    res.json(farmerDto(farmer));
  }),
);

router.patch(
  "/profile",
  authenticate,
  asyncRoute(async (req, res) => {
    const farmerId = requireFarmer(req, res);
    if (!farmerId) return;
    const body = UpdateProfileBody.parse(req.body);
    const [farmer] = await db
      .update(farmers)
      .set({
        ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.primaryLanguage !== undefined ? { primaryLanguage: body.primaryLanguage } : {}),
        ...(body.defaultState !== undefined ? { defaultState: body.defaultState } : {}),
        ...(body.defaultDistrict !== undefined ? { defaultDistrict: body.defaultDistrict } : {}),
        updatedAt: new Date(),
      })
      .where(eq(farmers.id, farmerId))
      .returning();
    res.json(UpdateProfileResponse.parse(farmerDto(farmer)));
  }),
);

router.get(
  "/farms",
  authenticate,
  asyncRoute(async (req, res) => {
    const farmerId = requireFarmer(req, res);
    if (!farmerId) return;
    const rows = await db
      .select()
      .from(farms)
      .where(and(eq(farms.farmerId, farmerId), eq(farms.isArchived, false)))
      .orderBy(asc(farms.name));
    res.json(ListFarmsResponse.parse(rows.map(farmDto)));
  }),
);

router.post(
  "/farms",
  authenticate,
  asyncRoute(async (req, res) => {
    const farmerId = requireFarmer(req, res);
    if (!farmerId) return;
    const body = CreateFarmBody.parse(req.body);
    const [farm] = await db
      .insert(farms)
      .values({
        farmerId,
        name: body.name,
        village: body.village,
        district: body.district,
        state: body.state,
        gpsLat: body.gpsLat?.toString(),
        gpsLng: body.gpsLng?.toString(),
        soilType: body.soilType,
        areaAcres: body.areaAcres.toString(),
        primaryIrrigation: body.primaryIrrigation,
      })
      .returning();
    res.status(201).json(CreateFarmResponse.parse(farmDto(farm)));
  }),
);

router.get(
  "/farms/:farmId",
  authenticate,
  asyncRoute(async (req, res) => {
    const farmerId = requireFarmer(req, res);
    if (!farmerId) return;
    const { farmId } = GetFarmParams.parse(req.params);
    const farm = await ownedFarm(farmId, farmerId);
    if (!farm) {
      res.status(404).json({ error: "Farm not found." });
      return;
    }
    res.json(GetFarmResponse.parse(farmDto(farm)));
  }),
);

router.patch(
  "/farms/:farmId",
  authenticate,
  asyncRoute(async (req, res) => {
    const farmerId = requireFarmer(req, res);
    if (!farmerId) return;
    const { farmId } = UpdateFarmParams.parse(req.params);
    const body = UpdateFarmBody.parse(req.body);
    if (!(await ownedFarm(farmId, farmerId))) {
      res.status(404).json({ error: "Farm not found." });
      return;
    }
    const [farm] = await db
      .update(farms)
      .set({
        name: body.name,
        village: body.village,
        district: body.district,
        state: body.state,
        gpsLat: body.gpsLat?.toString(),
        gpsLng: body.gpsLng?.toString(),
        soilType: body.soilType,
        areaAcres: body.areaAcres.toString(),
        primaryIrrigation: body.primaryIrrigation,
        updatedAt: new Date(),
      })
      .where(and(eq(farms.id, farmId), eq(farms.farmerId, farmerId)))
      .returning();
    res.json(UpdateFarmResponse.parse(farmDto(farm)));
  }),
);

router.delete(
  "/farms/:farmId",
  authenticate,
  asyncRoute(async (req, res) => {
    const farmerId = requireFarmer(req, res);
    if (!farmerId) return;
    const { farmId } = ArchiveFarmParams.parse(req.params);
    const [farm] = await db
      .update(farms)
      .set({ isArchived: true, updatedAt: new Date() })
      .where(and(eq(farms.id, farmId), eq(farms.farmerId, farmerId), eq(farms.isArchived, false)))
      .returning();
    if (!farm) {
      res.status(404).json({ error: "Farm not found." });
      return;
    }
    res.json({ message: "Farm archived." });
  }),
);

router.get(
  "/farms/:farmId/advisories",
  authenticate,
  asyncRoute(async (req, res) => {
    const farmerId = requireFarmer(req, res);
    if (!farmerId) return;
    const { farmId } = ListFarmAdvisoriesParams.parse(req.params);
    if (!(await ownedFarm(farmId, farmerId, true))) {
      res.status(404).json({ error: "Farm not found." });
      return;
    }
    const rows = await db
      .select({ advisory: cropAdvisories, farm: farms })
      .from(cropAdvisories)
      .innerJoin(farms, eq(cropAdvisories.farmId, farms.id))
      .where(and(eq(cropAdvisories.farmId, farmId), eq(cropAdvisories.farmerId, farmerId)))
      .orderBy(desc(cropAdvisories.createdAt));
    res.json(ListFarmAdvisoriesResponse.parse(rows.map((row) => advisoryDto(row.advisory, row.farm.name))));
  }),
);

router.post(
  "/farms/:farmId/advisories",
  authenticate,
  aiLimiter,
  asyncRoute(async (req, res) => {
    const farmerId = requireFarmer(req, res);
    if (!farmerId) return;
    const { farmId } = CreateAdvisoryParams.parse(req.params);
    const body = CreateAdvisoryBody.parse(req.body);
    const farm = await ownedFarm(farmId, farmerId);
    if (!farm) {
      res.status(404).json({ error: "Farm not found." });
      return;
    }
    const soilTypeUsed = body.soilTypeOverride ?? farm.soilType;
    const landAreaAcres = body.landAreaAcres ?? numeric(farm.areaAcres) ?? 0;
    const { parsed, raw } = await generateAdvisory({
      season: body.season,
      soilTypeUsed,
      landAreaAcres,
      irrigationUsed: body.irrigationAvailability,
      budgetTier: body.budgetTier,
      previousCrop: body.previousCrop,
      knownSoilIssues: body.knownSoilIssues ?? [],
      farmerGoal: body.farmerGoal,
      additionalNotes: body.additionalNotes,
    });
    const [advisory] = await db
      .insert(cropAdvisories)
      .values({
        farmId,
        farmerId,
        season: body.season,
        soilTypeUsed,
        landAreaAcresUsed: landAreaAcres.toString(),
        irrigationUsed: body.irrigationAvailability,
        budgetTier: body.budgetTier,
        previousCrop: body.previousCrop,
        knownSoilIssues: body.knownSoilIssues ?? [],
        farmerGoal: body.farmerGoal,
        additionalNotes: body.additionalNotes,
        aiRawResponse: raw,
        recommendedCrops: parsed.recommended_crops.map((crop) => ({
          cropName: crop.crop_name,
          rank: crop.rank,
          suitabilityReason: crop.suitability_reason,
          estimatedYieldPerAcre: crop.estimated_yield_per_acre,
          estimatedInputCostPerAcre: crop.estimated_input_cost_per_acre,
          estimatedRevenuePerAcre: crop.estimated_revenue_per_acre,
        })),
        fertilizerPlan: {
          sowingStage: parsed.fertilizer_plan.sowing_stage,
          vegetativeStage: parsed.fertilizer_plan.vegetative_stage,
          floweringStage: parsed.fertilizer_plan.flowering_stage,
          maturityStage: parsed.fertilizer_plan.maturity_stage,
        },
        irrigationPlan: {
          sowingStage: parsed.irrigation_plan.sowing_stage,
          vegetativeStage: parsed.irrigation_plan.vegetative_stage,
          floweringStage: parsed.irrigation_plan.flowering_stage,
          maturityStage: parsed.irrigation_plan.maturity_stage,
          frequencySummary: parsed.irrigation_plan.frequency_summary,
        },
        riskFactors: parsed.risk_factors,
        confidenceScore: parsed.confidence_score.toString(),
        modelVersion: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      })
      .returning();
    res.status(201).json(advisoryDto(advisory, farm.name));
  }),
);

router.get(
  "/advisories/:advisoryId",
  authenticate,
  asyncRoute(async (req, res) => {
    const farmerId = requireFarmer(req, res);
    if (!farmerId) return;
    const { advisoryId } = GetAdvisoryParams.parse(req.params);
    const rows = await db
      .select({ advisory: cropAdvisories, farm: farms })
      .from(cropAdvisories)
      .innerJoin(farms, eq(cropAdvisories.farmId, farms.id))
      .where(and(eq(cropAdvisories.id, advisoryId), eq(cropAdvisories.farmerId, farmerId)))
      .limit(1);
    if (!rows[0]) {
      res.status(404).json({ error: "Advisory not found." });
      return;
    }
    res.json(GetAdvisoryResponse.parse(advisoryDto(rows[0].advisory, rows[0].farm.name)));
  }),
);

router.get(
  "/farms/:farmId/diagnostics",
  authenticate,
  asyncRoute(async (req, res) => {
    const farmerId = requireFarmer(req, res);
    if (!farmerId) return;
    const { farmId } = ListFarmDiagnosticsParams.parse(req.params);
    if (!(await ownedFarm(farmId, farmerId, true))) {
      res.status(404).json({ error: "Farm not found." });
      return;
    }
    const rows = await db
      .select({ diagnostic: pestDiagnostics, farm: farms })
      .from(pestDiagnostics)
      .innerJoin(farms, eq(pestDiagnostics.farmId, farms.id))
      .where(and(eq(pestDiagnostics.farmId, farmId), eq(pestDiagnostics.farmerId, farmerId)))
      .orderBy(desc(pestDiagnostics.createdAt));
    res.json(ListFarmDiagnosticsResponse.parse(rows.map((row) => diagnosticDto(row.diagnostic, row.farm.name))));
  }),
);

router.post(
  "/farms/:farmId/diagnostics",
  authenticate,
  aiLimiter,
  asyncRoute(async (req, res) => {
    const farmerId = requireFarmer(req, res);
    if (!farmerId) return;
    const { farmId } = CreateDiagnosticParams.parse(req.params);
    const body = CreateDiagnosticBody.parse(req.body);
    const farm = await ownedFarm(farmId, farmerId);
    if (!farm) {
      res.status(404).json({ error: "Farm not found." });
      return;
    }
    const { parsed, raw } = await generateDiagnostic(body);
    const [diagnostic] = await db
      .insert(pestDiagnostics)
      .values({
        farmId,
        farmerId,
        affectedCrop: body.affectedCrop,
        growthStage: body.growthStage,
        symptomCategory: body.symptomCategory,
        symptomDescription: body.symptomDescription,
        affectedPlantPart: body.affectedPlantPart,
        daysSinceSymptomsAppeared: body.daysSinceSymptomsAppeared?.toString(),
        weatherRecent: body.weatherRecent,
        aiRawResponse: raw,
        likelyDiagnosis: parsed.likely_diagnosis,
        confidenceScore: parsed.confidence_score.toString(),
        possibleCauses: parsed.possible_causes,
        treatmentPlan: {
          organicOption: parsed.treatment_plan.organic_option,
          chemicalOption: parsed.treatment_plan.chemical_option,
          applicationGuidance: parsed.treatment_plan.application_guidance,
        },
        preventionTips: parsed.prevention_tips,
        modelVersion: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      })
      .returning();
    res.status(201).json(diagnosticDto(diagnostic, farm.name));
  }),
);

router.get(
  "/diagnostics/:diagnosticId",
  authenticate,
  asyncRoute(async (req, res) => {
    const farmerId = requireFarmer(req, res);
    if (!farmerId) return;
    const { diagnosticId } = GetDiagnosticParams.parse(req.params);
    const rows = await db
      .select({ diagnostic: pestDiagnostics, farm: farms })
      .from(pestDiagnostics)
      .innerJoin(farms, eq(pestDiagnostics.farmId, farms.id))
      .where(and(eq(pestDiagnostics.id, diagnosticId), eq(pestDiagnostics.farmerId, farmerId)))
      .limit(1);
    if (!rows[0]) {
      res.status(404).json({ error: "Diagnostic not found." });
      return;
    }
    res.json(GetDiagnosticResponse.parse(diagnosticDto(rows[0].diagnostic, rows[0].farm.name)));
  }),
);

router.patch(
  "/diagnostics/:diagnosticId/resolve",
  authenticate,
  asyncRoute(async (req, res) => {
    const farmerId = requireFarmer(req, res);
    if (!farmerId) return;
    const { diagnosticId } = ResolveDiagnosticParams.parse(req.params);
    const rows = await db
      .select({ diagnostic: pestDiagnostics, farm: farms })
      .from(pestDiagnostics)
      .innerJoin(farms, eq(pestDiagnostics.farmId, farms.id))
      .where(and(eq(pestDiagnostics.id, diagnosticId), eq(pestDiagnostics.farmerId, farmerId)))
      .limit(1);
    if (!rows[0]) {
      res.status(404).json({ error: "Diagnostic not found." });
      return;
    }
    const [updated] = await db
      .update(pestDiagnostics)
      .set({ isResolved: true })
      .where(and(eq(pestDiagnostics.id, diagnosticId), eq(pestDiagnostics.farmerId, farmerId)))
      .returning();
    res.json(ResolveDiagnosticResponse.parse(diagnosticDto(updated, rows[0].farm.name)));
  }),
);

router.get(
  "/dashboard/summary",
  authenticate,
  asyncRoute(async (req, res) => {
    const farmerId = requireFarmer(req, res);
    if (!farmerId) return;
    const [farmerFarms, advisories, diagnostics, recent] = await Promise.all([
      db.select().from(farms).where(and(eq(farms.farmerId, farmerId), eq(farms.isArchived, false))),
      db.select().from(cropAdvisories).where(eq(cropAdvisories.farmerId, farmerId)),
      db.select().from(pestDiagnostics).where(eq(pestDiagnostics.farmerId, farmerId)),
      db
        .select({ advisory: cropAdvisories, farm: farms })
        .from(cropAdvisories)
        .innerJoin(farms, eq(cropAdvisories.farmId, farms.id))
        .where(eq(cropAdvisories.farmerId, farmerId))
        .orderBy(desc(cropAdvisories.createdAt))
        .limit(5),
    ]);
    const summary = {
      farmCount: farmerFarms.length,
      advisoryCount: advisories.length,
      diagnosticCount: diagnostics.length,
      unresolvedDiagnosticCount: diagnostics.filter((item) => !item.isResolved).length,
      recentAdvisories: recent.map(({ advisory, farm }) => {
        const crops = advisory.recommendedCrops as Array<{ cropName?: string; crop_name?: string }>;
        return {
          id: advisory.id,
          farmId: advisory.farmId,
          farmName: farm.name,
          season: advisory.season,
          topCrop: crops[0]?.cropName ?? crops[0]?.crop_name ?? "Crop plan",
          confidenceScore: numeric(advisory.confidenceScore) ?? 0,
          createdAt: advisory.createdAt,
        };
      }),
    };
    res.json(GetDashboardSummaryResponse.parse(summary));
  }),
);

router.get(
  "/history",
  authenticate,
  asyncRoute(async (req, res) => {
    const farmerId = requireFarmer(req, res);
    if (!farmerId) return;
    const parsedQuery = GetHistoryQueryParams.parse({
      ...req.query,
      from: req.query.from ? new Date(String(req.query.from)) : undefined,
      to: req.query.to ? new Date(String(req.query.to)) : undefined,
    });
    const [advisoryRows, diagnosticRows] = await Promise.all([
      db
        .select({ advisory: cropAdvisories, farm: farms })
        .from(cropAdvisories)
        .innerJoin(farms, eq(cropAdvisories.farmId, farms.id))
        .where(eq(cropAdvisories.farmerId, farmerId)),
      db
        .select({ diagnostic: pestDiagnostics, farm: farms })
        .from(pestDiagnostics)
        .innerJoin(farms, eq(pestDiagnostics.farmId, farms.id))
        .where(eq(pestDiagnostics.farmerId, farmerId)),
    ]);
    const from = parsedQuery.from?.getTime();
    const to = parsedQuery.to?.getTime();
    const inRange = (date: Date) =>
      (from === undefined || date.getTime() >= from) && (to === undefined || date.getTime() <= to);
    const cropMatches = (text: string) =>
      !parsedQuery.crop || text.toLowerCase().includes(parsedQuery.crop.toLowerCase());
    const items = [
      ...(parsedQuery.type !== "diagnostic"
        ? advisoryRows
            .filter(({ advisory }) => inRange(advisory.createdAt) && cropMatches(String(advisory.recommendedCrops)))
            .map(({ advisory, farm }) => ({
              id: advisory.id,
              type: "advisory" as const,
              farmId: advisory.farmId,
              farmName: farm.name,
              title: "Crop advisory",
              subtitle: `${advisory.season} plan · ${advisory.soilTypeUsed} soil`,
              confidenceScore: numeric(advisory.confidenceScore) ?? 0,
              isResolved: null,
              createdAt: advisory.createdAt,
            }))
        : []),
      ...(parsedQuery.type !== "advisory"
        ? diagnosticRows
            .filter(({ diagnostic }) => inRange(diagnostic.createdAt) && cropMatches(diagnostic.affectedCrop))
            .map(({ diagnostic, farm }) => ({
              id: diagnostic.id,
              type: "diagnostic" as const,
              farmId: diagnostic.farmId,
              farmName: farm.name,
              title: diagnostic.likelyDiagnosis,
              subtitle: diagnostic.affectedCrop,
              confidenceScore: numeric(diagnostic.confidenceScore) ?? 0,
              isResolved: diagnostic.isResolved,
              createdAt: diagnostic.createdAt,
            }))
        : []),
    ].filter((item) => !parsedQuery.farmId || item.farmId === parsedQuery.farmId);
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    res.json(GetHistoryResponse.parse(items));
  }),
);

router.use((error: unknown, req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1], next: Parameters<RequestHandler>[2]) => {
  if (error instanceof AIServiceError) {
    req.log.error({ err: error }, "AI service failure");
    res.status(error.status).json({ error: error.code });
    return;
  }
  if (error instanceof Error && error.name === "ZodError") {
    res.status(400).json({ error: "Please check the submitted information." });
    return;
  }
  handleRouteError(error, req, res, next);
});

export default router;