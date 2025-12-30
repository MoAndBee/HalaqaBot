import { ImageGeneratorService } from './services/image-generator.service';
import type { ListData } from './services/image-generator.service';
import { writeFile } from 'fs/promises';
import { join } from 'path';

async function generateExamples() {
  const imageGenerator = new ImageGeneratorService();

  // Sample data matching the user's example
  const sampleData: ListData = {
    date: '30/12/2025',
    teacherName: 'آية فارق',
    supervisorName: 'فاطمة أحمد',
    participants: [
      {
        name: 'دِثار عادل محمد',
        isDone: true,
        wasSkipped: false,
      },
      {
        name: 'سارة أحمد الغطريفي',
        isDone: true,
        wasSkipped: false,
      },
      {
        name: 'إشراقة أحمد كرار',
        isDone: false,
        wasSkipped: false,
      },
      {
        name: 'آلاء أحمد حمدان',
        isDone: false,
        wasSkipped: true,
      },
      {
        name: 'شهد علاء عبدالمعطي',
        isDone: false,
        wasSkipped: false,
      },
      {
        name: 'ماهيتاب عامر عبدالمقصود',
        isDone: false,
        wasSkipped: false,
      },
    ],
  };

  console.log('Generating Theme 1: Gradient Elegance...');
  const theme1Image = await imageGenerator.generateListImage(sampleData, 'gradient-elegance');
  await writeFile(join(process.cwd(), 'example-theme1-gradient-elegance.png'), theme1Image);
  console.log('✅ Theme 1 saved as: example-theme1-gradient-elegance.png');

  console.log('\nGenerating Theme 3: Islamic Geometric...');
  const theme3Image = await imageGenerator.generateListImage(sampleData, 'islamic-geometric');
  await writeFile(join(process.cwd(), 'example-theme3-islamic-geometric.png'), theme3Image);
  console.log('✅ Theme 3 saved as: example-theme3-islamic-geometric.png');

  console.log('\n🎉 Both example images generated successfully!');
  console.log('\nFiles created:');
  console.log('  - example-theme1-gradient-elegance.png');
  console.log('  - example-theme3-islamic-geometric.png');
}

generateExamples().catch(console.error);
