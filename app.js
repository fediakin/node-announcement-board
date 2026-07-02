import express from 'express';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const prisma = new PrismaClient();
const PORT = 3000;

// Допоміжний об'єкт для категорій
const categoryInfo = {
  sale: { label: 'Продаж', emoji: '📦' },
  service: { label: 'Послуги', emoji: '🔧' },
  job: { label: 'Робота', emoji: '💼' },
  other: { label: 'Інше', emoji: '📌' }
};

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Зробимо categoryInfo доступним у всіх шаблонах
app.use((req, res, next) => {
  res.locals.categoryInfo = categoryInfo;
  next();
});

// 1. Головна сторінка (Список, пошук, пагінація, сортування)
app.get('/', async (req, res, next) => {
  try {
    const { search, sort = 'newest', page = 1 } = req.query;
    
    // Фільтрація (пошук)
    const where = search ? { title: { contains: search } } : {};
    
    // Сортування
    const orderBy = { createdAt: sort === 'oldest' ? 'asc' : 'desc' };
    
    // Пагінація
    const perPage = 10;
    const pageNum = Math.max(1, Number(page) || 1);
    const skip = (pageNum - 1) * perPage;

    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({ where, orderBy, skip, take: perPage }),
      prisma.announcement.count({ where })
    ]);

    const totalPages = Math.ceil(total / perPage);

    res.render('index', { 
      announcements, search, sort, pageNum, totalPages 
    });
  } catch (error) {
    next(error);
  }
});

// 2. Сторінка створення (Форма)
app.get('/announcements', (req, res) => {
  res.render('new', { errors: {}, data: null });
});

// 3. Обробка створення оголошення (Валідація)
app.post('/announcements', async (req, res, next) => {
  try {
    const { title, description, price, category, contactInfo } = req.body;
    const errors = {};

    if (!title || title.trim().length < 5) errors.title = 'Назва має бути не менше 5 символів';
    if (!description || description.trim().length < 10) errors.description = 'Опис має бути не менше 10 символів';
    if (!['sale', 'service', 'job', 'other'].includes(category)) errors.category = 'Оберіть категорію';
    if (!price || isNaN(price) || Number(price) <= 0) errors.price = 'Ціна має бути додатним числом';
    if (!contactInfo || contactInfo.trim().length < 5) errors.contactInfo = 'Контакти мають бути не менше 5 символів';

    if (Object.keys(errors).length > 0) {
      return res.render('new', { errors, data: req.body });
    }

    const announcement = await prisma.announcement.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        category,
        contactInfo: contactInfo.trim()
      }
    });

    res.redirect(`/announcements/${announcement.id}`);
  } catch (error) {
    next(error);
  }
});

// 4. Сторінка одного оголошення
app.get('/announcements/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(404).render('404');

    const announcement = await prisma.announcement.findUnique({ where: { id } });
    
    if (!announcement) return res.status(404).render('404');

    res.render('announcement', { announcement });
  } catch (error) {
    next(error);
  }
});

// 5. Видалення оголошення
app.delete('/announcements/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.announcement.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).render('404');
});

// Error Handler (500)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});