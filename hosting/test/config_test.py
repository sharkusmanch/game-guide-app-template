import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('runtime', pathlib.Path(__file__).parents[1] / 'entrypoint.py')
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)

class Configuration(unittest.TestCase):
    def test_defaults_and_exact_save(self):
        conf = runtime.configuration({})
        self.assertIn('location = /save {', conf)
        self.assertIn('alias /saves/unconfigured.bin;', conf)
        self.assertIn('location ^~ /save/ { return 404; }', conf)
        self.assertNotIn('proxy_pass', conf)
        self.assertIn('Cache-Control "no-store" always', conf)

    def test_selected_routes_preserve_prefix_and_strip_credentials(self):
        conf = runtime.configuration({'PROGRESS_IDS': '12,34', 'PROGRESS_UPSTREAM': 'progress:8080', 'PROGRESS_PREFIX': '/service/v1'})
        self.assertIn('location = /service/v1/api/achievements/ra/12', conf)
        self.assertIn('proxy_pass http://progress:8080/service/v1/api/achievements/ra/12;', conf)
        self.assertIn('proxy_pass_request_headers off;', conf)
        self.assertIn('proxy_pass_request_body off;', conf)
        self.assertIn('proxy_set_header Content-Length "";', conf)

    def test_injection_and_ambiguous_inputs_rejected(self):
        bad = [('SAVE_FILE', '/saves/a;return 200;'), ('SAVE_FILE', '/saves/../secret'), ('SAVE_FILE', 'relative'), ('SAVE_FILE', '/saves/$name'), ('PROGRESS_PREFIX', '/'), ('PROGRESS_PREFIX', '/x/../y'), ('PROGRESS_PREFIX', '/x/'), ('PROGRESS_PREFIX', '/save/sub'), ('PROGRESS_PREFIX', '/save-other'), ('PROGRESS_UPSTREAM', 'https://host:1'), ('PROGRESS_UPSTREAM', 'host:65536'), ('PROGRESS_IDS', '0'), ('PROGRESS_IDS', '1,1'), ('PROGRESS_IDS', '1,'), ('PROGRESS_IDS', ','.join(str(i) for i in range(1,34)))]
        for key, value in bad:
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                runtime.configuration({key: value})
        with self.assertRaises(ValueError):
            runtime.configuration({'PROGRESS_IDS': '1'})

if __name__ == '__main__':
    unittest.main()
