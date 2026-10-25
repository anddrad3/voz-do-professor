import importlib.util
import time
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('rfb', 'scripts/rfb-sync.py')
rfb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rfb)

class RfbTests(unittest.TestCase):
    def test_minimization_and_active_education_only(self):
        row = [''] * 30
        row[:3] = ['12ABCDEF', '0001', '35']
        row[4], row[5], row[11] = 'Escola de teste', '02', '8512100'
        row[19], row[20], row[27] = 'SP', '1', 'privado@example.test'
        item = rfb.institution(row, {'1': 'Franca'}, '2026-10')
        self.assertEqual(item['cnpj'], '12ABCDEF000135')
        self.assertEqual(item['city'], 'Franca')
        self.assertNotIn('privado', str(item))
        row[5] = '08'
        self.assertIsNone(rfb.institution(row, {}, '2026-10'))
        row[5], row[11] = '02', '4711301'
        self.assertIsNone(rfb.institution(row, {}, '2026-10'))

    def test_download_blocked_before_exceeding_budget(self):
        file = rfb.RangeFile('https://example.test/data.zip', 5000000, 100, time.monotonic() + 5)
        with patch('urllib.request.urlopen') as request:
            with self.assertRaisesRegex(RuntimeError, 'tráfego'):
                file.read(1)
            request.assert_not_called()

    def test_full_download_response_is_rejected(self):
        file = rfb.RangeFile('https://example.test/data.zip', 20, 100, time.monotonic() + 5)
        with patch('urllib.request.urlopen') as request:
            response = request.return_value.__enter__.return_value
            response.status = 200
            with self.assertRaisesRegex(RuntimeError, 'integral bloqueado'):
                file.read(1)
            response.read.assert_not_called()

if __name__ == '__main__':
    unittest.main()
