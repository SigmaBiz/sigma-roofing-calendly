import { users, contactRequests, projects, websiteImages, type User, type InsertUser, type ContactRequest, type InsertContactRequest, type Project, type InsertProject, type WebsiteImages, type InsertWebsiteImages } from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createContactRequest(request: InsertContactRequest): Promise<ContactRequest>;
  getContactRequests(): Promise<ContactRequest[]>;
  createProject(project: InsertProject): Promise<Project>;
  getProjects(): Promise<Project[]>;
  deleteProject(id: number): Promise<boolean>;
  saveProjects(projects: any[]): Promise<boolean>;
  getWebsiteImages(): Promise<WebsiteImages | undefined>;
  updateWebsiteImages(images: InsertWebsiteImages): Promise<WebsiteImages>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private contactRequests: Map<number, ContactRequest>;
  private projects: Map<number, Project>;
  private websiteImages: WebsiteImages | undefined;
  private currentUserId: number;
  private currentContactId: number;
  private currentProjectId: number;

  constructor() {
    this.users = new Map();
    this.contactRequests = new Map();
    this.projects = new Map();
    this.currentUserId = 1;
    this.currentContactId = 1;
    this.currentProjectId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createContactRequest(request: InsertContactRequest): Promise<ContactRequest> {
    const id = this.currentContactId++;
    const contactRequest: ContactRequest = {
      ...request,
      id,
      createdAt: new Date(),
    };
    this.contactRequests.set(id, contactRequest);
    return contactRequest;
  }

  async getContactRequests(): Promise<ContactRequest[]> {
    return Array.from(this.contactRequests.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async createProject(project: InsertProject): Promise<Project> {
    const id = this.currentProjectId++;
    const newProject: Project = {
      ...project,
      location: project.location || null,
      id,
      isActive: "true",
      createdAt: new Date(),
    };
    this.projects.set(id, newProject);
    return newProject;
  }

  async getProjects(): Promise<Project[]> {
    return Array.from(this.projects.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async deleteProject(id: number): Promise<boolean> {
    return this.projects.delete(id);
  }

  async saveProjects(projects: any[]): Promise<boolean> {
    try {
      // Clear existing projects and add new ones
      this.projects.clear();
      this.currentProjectId = 1;
      
      for (const project of projects) {
        const id = this.currentProjectId++;
        const newProject: Project = {
          id,
          title: project.title || 'Untitled Project',
          description: project.description || '',
          imageUrl: project.image || project.imageUrl || '',
          category: project.category || 'General',
          location: project.location || 'Edmond, OK',
          isActive: "true",
          createdAt: new Date()
        };
        this.projects.set(id, newProject);
      }
      return true;
    } catch (error) {
      console.error('Error saving projects:', error);
      return false;
    }
  }

  async getWebsiteImages(): Promise<WebsiteImages | undefined> {
    return this.websiteImages;
  }

  async updateWebsiteImages(images: InsertWebsiteImages): Promise<WebsiteImages> {
    // Get existing images to preserve them
    const existing = this.websiteImages || {} as WebsiteImages;
    
    const updatedImages: WebsiteImages = {
      id: 1,
      heroBackground: images.heroBackground || existing.heroBackground || null,
      heroFeatureImage: images.heroFeatureImage || existing.heroFeatureImage || null,
      residentialRoofingImage: images.residentialRoofingImage || existing.residentialRoofingImage || null,
      roofRepairImage: images.roofRepairImage || existing.roofRepairImage || null,
      roofInspectionImage: images.roofInspectionImage || existing.roofInspectionImage || null,
      gutterServiceImage: images.gutterServiceImage || existing.gutterServiceImage || null,
      stormDamageImage: images.stormDamageImage || existing.stormDamageImage || null,
      paintingServiceImage: images.paintingServiceImage || existing.paintingServiceImage || null,
      teamPhoto: images.teamPhoto || existing.teamPhoto || null,
      visionImage: images.visionImage || existing.visionImage || null,
      companyLogo: images.companyLogo || existing.companyLogo || null,
      processStep1Image: images.processStep1Image || existing.processStep1Image || null,
      processStep2Image: images.processStep2Image || existing.processStep2Image || null,
      processStep3Image: images.processStep3Image || existing.processStep3Image || null,
      processStep4Image: images.processStep4Image || existing.processStep4Image || null,
      testimonialBackground: images.testimonialBackground || existing.testimonialBackground || null,
      stormReportBackground: images.stormReportBackground || existing.stormReportBackground || null,
      updatedAt: new Date(),
    };
    this.websiteImages = updatedImages;
    return updatedImages;
  }
}

export const storage = new MemStorage();