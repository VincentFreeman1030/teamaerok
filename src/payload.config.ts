import path from 'path'
import { buildFigmaConfig } from '@payloadcms/figma'
import { mcpPlugin } from '@payloadcms/plugin-mcp'
import { ko as adminLanguage } from '@payloadcms/translations/languages/ko'
import { fileURLToPath } from 'url'
import { Admins } from './collections/Admins'
import { Media } from './collections/Media'
import { Folders } from './collections/Folders'
import { Tags } from './collections/Tags'
import { InterviewSets } from './collections/InterviewSets'
import { InterviewQuestions } from './collections/InterviewQuestions'
import { InterviewFollowUps } from './collections/InterviewFollowUps'
import { Experiences } from './collections/Experiences'
import { StudyRecords } from './collections/StudyRecords'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildFigmaConfig({
  admin: {
    user: Admins.slug,
    constrainWidth: true,
    dashboard: {
      widgets: [],
      defaultLayout: [
        { widgetSlug: 'activity', width: 'full' },
        { widgetSlug: 'collections', width: 'full' },
      ],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  i18n: {
    fallbackLanguage: 'ko',
    supportedLanguages: { 'ko': adminLanguage },
  },
  collections: [
    Admins,
    Media,
    Folders,
    Tags,
    InterviewSets,
    InterviewQuestions,
    InterviewFollowUps,
    Experiences,
    StudyRecords,
  ],
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  localization: {
    locales: [{ code: 'en', label: 'English' }],
    fallback: true,
    defaultLocale: 'en',
  },
  plugins: [mcpPlugin({})],
  figma: {},
})
