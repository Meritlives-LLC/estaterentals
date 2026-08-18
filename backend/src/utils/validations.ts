// backend/src/utils/validations.ts
import { z } from 'zod'

export const LoginSchema = z.object({
  email: z.string().min(1, 'Email or username is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const AdminOtpVerifySchema = z.object({
  email: z.string().trim().min(1, 'Email required'),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be a 6-digit code'),
})

export const AdminOtpResendSchema = z.object({
  email: z.string().trim().min(1, 'Email required'),
})

export const StaffLoginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6),
})

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string().min(1),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const CreateStaffSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username may only contain letters, numbers, dots, underscores and hyphens'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2).max(100).optional(),
})

export const UpdateStaffSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  isActive: z.boolean().optional(),
})

const latitudeSchema = z.coerce.number().refine((value) => Number.isFinite(value) && value >= -90 && value <= 90, {
  message: 'Latitude must be between -90 and 90',
})

const longitudeSchema = z.coerce.number().refine((value) => Number.isFinite(value) && value >= -180 && value <= 180, {
  message: 'Longitude must be between -180 and 180',
})

export const PropertySchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20),
  price: z.coerce.number().positive(),
  priceUnit: z.enum(['MONTH', 'YEAR', 'WEEK', 'DAY']).default('MONTH'),
  location: z.string().min(2),
  city: z.string().min(2),
  state: z.string().min(2),
  address: z.string().min(5),
  type: z.enum(['APARTMENT', 'HOUSE', 'STUDIO', 'DUPLEX', 'PENTHOUSE', 'COMMERCIAL', 'LAND']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'RENTED']).default('ACTIVE'),
  bedrooms: z.coerce.number().min(0).max(20),
  bathrooms: z.coerce.number().min(0).max(20),
  listingType: z.enum(['RENT', 'SALE']).default('RENT'),
  area: z.coerce.number().positive().optional(),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  featured: z.boolean().default(false),
  amenities: z.array(z.string()).optional(),
  images: z
    .array(
      z.object({
        url: z.string().url(),
        publicId: z.string(),
        alt: z.string().optional(),
        order: z.number().optional(),
      })
    )
    .optional(),
  videos: z
    .array(
      z.object({
        videoId: z.string(),
        url: z.string().optional().nullable(),
        thumbnailUrl: z.string().optional().nullable(),
        title: z.string().optional().nullable(),
        duration: z.number().optional().nullable(),
        width: z.number().optional().nullable(),
        height: z.number().optional().nullable(),
        format: z.string().optional().nullable(),
        size: z.number().optional().nullable(),
        order: z.number().optional(),
      })
    )
    .optional(),
})

export const PropertyPatchSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'RENTED']).optional(),
  featured: z.boolean().optional(),
})

export const MessageSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z
    .string()
    .regex(/^[+\d\s()-]{7,20}$/)
    .optional()
    .or(z.literal('')),
  subject: z.string().min(3).max(200),
  body: z.string().min(10).max(2000),
  propertyId: z.string().optional(),
})

export const MessagePatchSchema = z.object({
  status: z.enum(['READ', 'UNREAD']).optional(),
})

export const PropertyFilterSchema = z.object({
  search: z.string().optional(),
  city: z.string().optional(),
  type: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  bedrooms: z.coerce.number().optional(),
  featured: z.coerce.boolean().optional(),
  status: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(9),
  listingType: z.string().optional(),
})

export const ActivityFilterSchema = z.object({
  search: z.string().optional(),
  action: z.string().optional(),
  role: z.string().optional(),
  entityType: z.string().optional(),
  userId: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
})

export const PropertyLocationSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  address: z.string().min(1).optional(),
})

export const GeocodeQuerySchema = z.object({
  address: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1).optional(),
  country: z.string().trim().min(1).optional().default('Nigeria'),
})

export const VideoCompleteSchema = z.object({
  videoId: z.string().min(1),
  propertyId: z.string().min(1),
  title: z.string().optional(),
  order: z.number().optional(),
})
