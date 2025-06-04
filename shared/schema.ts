import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const contactRequests = pgTable("contact_requests", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  serviceType: text("service_type").notNull(),
  description: text("description"),
  preferredDate1: text("preferred_date1"),
  preferredTime1: text("preferred_time1"),
  preferredDate2: text("preferred_date2"),
  preferredTime2: text("preferred_time2"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertContactRequestSchema = createInsertSchema(contactRequests).omit({
  id: true,
  createdAt: true,
});

export type InsertContactRequest = z.infer<typeof insertContactRequestSchema>;
export type ContactRequest = typeof contactRequests.$inferSelect;

// Project gallery schema
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url").notNull(),
  category: text("category").notNull(),
  location: text("location"),
  isActive: text("is_active").default("true").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProjectSchema = createInsertSchema(projects).pick({
  title: true,
  description: true,
  imageUrl: true,
  category: true,
  location: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Website images schema
export const websiteImages = pgTable("website_images", {
  id: serial("id").primaryKey(),
  heroBackground: text("hero_background"),
  heroFeatureImage: text("hero_feature_image"),
  residentialRoofingImage: text("residential_roofing_image"),
  roofRepairImage: text("roof_repair_image"),
  roofInspectionImage: text("roof_inspection_image"),
  gutterServiceImage: text("gutter_service_image"),
  stormDamageImage: text("storm_damage_image"),
  paintingServiceImage: text("painting_service_image"),
  teamPhoto: text("team_photo"),
  visionImage: text("vision_image"),
  companyLogo: text("company_logo"),
  processStep1Image: text("process_step1_image"),
  processStep2Image: text("process_step2_image"),
  processStep3Image: text("process_step3_image"),
  processStep4Image: text("process_step4_image"),
  testimonialBackground: text("testimonial_background"),
  stormReportBackground: text("storm_report_background"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWebsiteImagesSchema = createInsertSchema(websiteImages).omit({
  id: true,
  updatedAt: true,
});

export type InsertWebsiteImages = z.infer<typeof insertWebsiteImagesSchema>;
export type WebsiteImages = typeof websiteImages.$inferSelect;
