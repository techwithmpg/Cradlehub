-- CradleHub service image URL backfill.
-- Run after supabase/migrations/20260527000001_add_service_image_fields.sql.

BEGIN;

UPDATE public.services
SET image_url = '/images/services/001-angels-massage.webp',
    image_alt = 'Angels Massage service at Cradle Massage and Wellness Spa'
WHERE id = '8bce4f5f-4392-457f-adea-1ccacf846dc6';

UPDATE public.services
SET image_url = '/images/services/002-aromatherapy.webp',
    image_alt = 'Aromatherapy service at Cradle Massage and Wellness Spa'
WHERE id = '17eab5d7-5ba9-4b92-8e90-e08f89182868';

UPDATE public.services
SET image_url = '/images/services/003-balinese-massage.webp',
    image_alt = 'Balinese Massage service at Cradle Massage and Wellness Spa'
WHERE id = '8d7c1157-ded4-4d81-b82c-73703c7476c7';

UPDATE public.services
SET image_url = '/images/services/004-combination-massage.webp',
    image_alt = 'Combination Massage service at Cradle Massage and Wellness Spa'
WHERE id = '327c112a-0809-4f4f-9338-3433042fe6fe';

UPDATE public.services
SET image_url = '/images/services/005-cradle-swedish-massage.webp',
    image_alt = 'Cradle Swedish Massage service at Cradle Massage and Wellness Spa'
WHERE id = '6da03aba-59cf-4f1e-a462-bc5cfb515b57';

UPDATE public.services
SET image_url = '/images/services/006-eco-sculpt-massage.webp',
    image_alt = 'Eco Sculpt Massage service at Cradle Massage and Wellness Spa'
WHERE id = '5608c197-69c2-40e5-81b1-6e8493a9696d';

UPDATE public.services
SET image_url = '/images/services/007-filipino-hilot.webp',
    image_alt = 'Filipino Hilot service at Cradle Massage and Wellness Spa'
WHERE id = '1b38f079-11e1-451a-a840-24bf891710fc';

UPDATE public.services
SET image_url = '/images/services/008-hawaiian-lomi-lomi-massage.webp',
    image_alt = 'Hawaiian Lomi Lomi Massage service at Cradle Massage and Wellness Spa'
WHERE id = '28cc582f-c4dc-40f5-8b41-7b4ddebebe0d';

UPDATE public.services
SET image_url = '/images/services/009-herbal-ball.webp',
    image_alt = 'Herbal Ball service at Cradle Massage and Wellness Spa'
WHERE id = '401b93cc-5690-436f-a01d-5d710a909e42';

UPDATE public.services
SET image_url = '/images/services/010-himalayan-hot-stone-massage.webp',
    image_alt = 'Himalayan Hot Stone Massage service at Cradle Massage and Wellness Spa'
WHERE id = '504bbe81-ae62-464e-9904-d6ed61d4d162';

UPDATE public.services
SET image_url = '/images/services/011-mandara-massage.webp',
    image_alt = 'Mandara Massage service at Cradle Massage and Wellness Spa'
WHERE id = '6d2ba131-4489-4101-926e-cd283b608507';

UPDATE public.services
SET image_url = '/images/services/012-moxa-ventosa.webp',
    image_alt = 'Moxa Ventosa service at Cradle Massage and Wellness Spa'
WHERE id = '3ce229fa-200c-43ba-8ad0-b5caab77a1f9';

UPDATE public.services
SET image_url = '/images/services/013-moxa-ventosa-with-pinoy-ginhawa.webp',
    image_alt = 'Moxa Ventosa w/ Pinoy Ginhawa service at Cradle Massage and Wellness Spa'
WHERE id = '1f038963-825f-4157-86ee-d59e9beb4dfe';

UPDATE public.services
SET image_url = '/images/services/014-post-natal-massage.webp',
    image_alt = 'Post Natal Massage service at Cradle Massage and Wellness Spa'
WHERE id = '2d491e10-085d-4f80-a2b9-4dfef3110a66';

UPDATE public.services
SET image_url = '/images/services/015-shiatsu.webp',
    image_alt = 'Shiatsu service at Cradle Massage and Wellness Spa'
WHERE id = '699cd2b4-f466-4d7e-8543-1534c0105c68';

UPDATE public.services
SET image_url = '/images/services/016-thai-massage.webp',
    image_alt = 'Thai Massage service at Cradle Massage and Wellness Spa'
WHERE id = '2c4f4dff-58b3-47d6-bcb4-5f4415e82ca8';

UPDATE public.services
SET image_url = '/images/services/017-swedish-massage-60min.webp',
    image_alt = 'Swedish Massage 60min service at Cradle Massage and Wellness Spa'
WHERE id = 'b1000000-0000-0000-0000-000000000001';

UPDATE public.services
SET image_url = '/images/services/018-swedish-massage-90min.webp',
    image_alt = 'Swedish Massage 90min service at Cradle Massage and Wellness Spa'
WHERE id = 'b1000000-0000-0000-0000-000000000002';

UPDATE public.services
SET image_url = '/images/services/019-deep-tissue-60min.webp',
    image_alt = 'Deep Tissue 60min service at Cradle Massage and Wellness Spa'
WHERE id = 'b1000000-0000-0000-0000-000000000003';

UPDATE public.services
SET image_url = '/images/services/020-deep-tissue-90min.webp',
    image_alt = 'Deep Tissue 90min service at Cradle Massage and Wellness Spa'
WHERE id = 'b1000000-0000-0000-0000-000000000004';

UPDATE public.services
SET image_url = '/images/services/021-blowdry-with-style.webp',
    image_alt = 'Blowdry with Style service at Cradle Massage and Wellness Spa'
WHERE id = '92ef98cf-046e-4af9-a6b4-f124c6316285';

UPDATE public.services
SET image_url = '/images/services/022-ear-candling.webp',
    image_alt = 'Ear Candling service at Cradle Massage and Wellness Spa'
WHERE id = '31aaf846-6a93-4ee1-962a-6b677e91c348';

UPDATE public.services
SET image_url = '/images/services/023-eye-make-up.webp',
    image_alt = 'Eye Make Up service at Cradle Massage and Wellness Spa'
WHERE id = '628e411f-7ab3-4aae-b00f-41a1539e42c1';

UPDATE public.services
SET image_url = '/images/services/024-eyebrow-threading.webp',
    image_alt = 'Eyebrow Threading service at Cradle Massage and Wellness Spa'
WHERE id = '67fb98f0-e7c0-4f06-8899-5f86c0970b41';

UPDATE public.services
SET image_url = '/images/services/025-eyelash-extensions-cat-eye.webp',
    image_alt = 'Eyelash Extensions Cat Eye service at Cradle Massage and Wellness Spa'
WHERE id = 'a23d7b88-0054-4afc-b4fa-b0481ddbecb8';

UPDATE public.services
SET image_url = '/images/services/026-eyelash-extensions-cradle-signature-lash.webp',
    image_alt = 'Eyelash Extensions Cradle Signature Lash service at Cradle Massage and Wellness Spa'
WHERE id = '53ca74bc-6747-4ae7-afc0-46c800559b14';

UPDATE public.services
SET image_url = '/images/services/027-eyelash-extensions-open-eye.webp',
    image_alt = 'Eyelash Extensions Open Eye service at Cradle Massage and Wellness Spa'
WHERE id = '5f3eee8b-5791-4b5b-b64d-6633e88d9c5a';

UPDATE public.services
SET image_url = '/images/services/028-foot-scrub.webp',
    image_alt = 'Foot Scrub service at Cradle Massage and Wellness Spa'
WHERE id = '7ae5edfe-2113-4fd8-aa91-863cb3ddde75';

UPDATE public.services
SET image_url = '/images/services/029-full-hair-and-make-up.webp',
    image_alt = 'Full Hair & Make Up service at Cradle Massage and Wellness Spa'
WHERE id = '6c7ac753-253f-4be4-8cae-76118c4d2514';

UPDATE public.services
SET image_url = '/images/services/030-gel-manicure-orly.webp',
    image_alt = 'Gel Manicure ORLY service at Cradle Massage and Wellness Spa'
WHERE id = '71b374bc-336a-4cc7-bc5c-f19429c58cf4';

UPDATE public.services
SET image_url = '/images/services/031-gel-pedicure-orly.webp',
    image_alt = 'Gel Pedicure ORLY service at Cradle Massage and Wellness Spa'
WHERE id = '039477da-498a-4e05-af2a-fb70c1e76184';

UPDATE public.services
SET image_url = '/images/services/032-hair-color-labor.webp',
    image_alt = 'Hair Color Labor service at Cradle Massage and Wellness Spa'
WHERE id = 'a81d5008-381d-430f-9a9b-7233f8a3c051';

UPDATE public.services
SET image_url = '/images/services/033-hair-color-long-hair.webp',
    image_alt = 'Hair Color Long Hair service at Cradle Massage and Wellness Spa'
WHERE id = '7237279b-8a14-4135-b318-e245a2be1ce4';

UPDATE public.services
SET image_url = '/images/services/034-hair-color-medium-hair.webp',
    image_alt = 'Hair Color Medium Hair service at Cradle Massage and Wellness Spa'
WHERE id = 'ab78a237-762b-4b6a-9e67-2601c18d91e8';

UPDATE public.services
SET image_url = '/images/services/035-hair-color-rootings-short-hair.webp',
    image_alt = 'Hair Color Rootings / Short Hair service at Cradle Massage and Wellness Spa'
WHERE id = '42712396-c118-4080-83bf-1a12aa6f84a3';

UPDATE public.services
SET image_url = '/images/services/036-hair-cut.webp',
    image_alt = 'Hair Cut service at Cradle Massage and Wellness Spa'
WHERE id = '225e8f68-1935-468d-af5c-bd803c344bb1';

UPDATE public.services
SET image_url = '/images/services/037-hair-cut-with-shampoo.webp',
    image_alt = 'Hair Cut with Shampoo service at Cradle Massage and Wellness Spa'
WHERE id = '595820eb-90b4-414a-81d0-2becbf901c5e';

UPDATE public.services
SET image_url = '/images/services/038-hair-iron.webp',
    image_alt = 'Hair Iron service at Cradle Massage and Wellness Spa'
WHERE id = 'a27a6112-b681-42b2-b5b2-a07716d6a67e';

UPDATE public.services
SET image_url = '/images/services/039-hair-nourishing-concentrating-vial-treatment.webp',
    image_alt = 'Hair Nourishing / Concentrating Vial Treatment service at Cradle Massage and Wellness Spa'
WHERE id = '6c043523-9721-49dd-ad10-a85802185613';

UPDATE public.services
SET image_url = '/images/services/040-hair-scrub-shampoo.webp',
    image_alt = 'Hair Scrub Shampoo service at Cradle Massage and Wellness Spa'
WHERE id = '0409114e-650e-4ddb-945e-1a5ebefa2ebd';

UPDATE public.services
SET image_url = '/images/services/041-hair-spa-long-hair.webp',
    image_alt = 'Hair Spa Long Hair service at Cradle Massage and Wellness Spa'
WHERE id = '9cba667a-7e17-4651-bc59-73d7d4699e04';

UPDATE public.services
SET image_url = '/images/services/042-hair-spa-medium-hair.webp',
    image_alt = 'Hair Spa Medium Hair service at Cradle Massage and Wellness Spa'
WHERE id = '3feb01fa-ca61-4a23-8776-43a70f18b825';

UPDATE public.services
SET image_url = '/images/services/043-hair-spa-short-hair.webp',
    image_alt = 'Hair Spa Short Hair service at Cradle Massage and Wellness Spa'
WHERE id = '5bfed6bd-d3c3-4607-a71a-987de016ffaa';

UPDATE public.services
SET image_url = '/images/services/044-hair-style-without-makeup.webp',
    image_alt = 'Hair Style without Makeup service at Cradle Massage and Wellness Spa'
WHERE id = '2b63f161-d616-431c-9e98-6f5c063bf8c2';

UPDATE public.services
SET image_url = '/images/services/045-kerabond.webp',
    image_alt = 'Kerabond service at Cradle Massage and Wellness Spa'
WHERE id = '4f90823c-9842-425e-9b4b-e844cf1a4fae';

UPDATE public.services
SET image_url = '/images/services/046-keratin-treatment-long-hair.webp',
    image_alt = 'Keratin Treatment Long Hair service at Cradle Massage and Wellness Spa'
WHERE id = '86394f80-0322-44fd-8504-599de95c9880';

UPDATE public.services
SET image_url = '/images/services/047-make-up-home-service.webp',
    image_alt = 'Make Up Home Service service at Cradle Massage and Wellness Spa'
WHERE id = '05deae94-ee04-4e36-8b67-ab5a62ca702b';

UPDATE public.services
SET image_url = '/images/services/048-mani-pedi-with-foot-spell-spa-package.webp',
    image_alt = 'Mani-Pedi w/ Foot Spell Spa Package service at Cradle Massage and Wellness Spa'
WHERE id = '03bf0330-9a5c-43dd-846e-3aebe9454ddc';

UPDATE public.services
SET image_url = '/images/services/049-metal-detox-package.webp',
    image_alt = 'Metal Detox Package service at Cradle Massage and Wellness Spa'
WHERE id = '389ab9b6-2521-4f35-9478-903bb5d596d9';

UPDATE public.services
SET image_url = '/images/services/050-metal-detox-treatment-only.webp',
    image_alt = 'Metal Detox Treatment Only service at Cradle Massage and Wellness Spa'
WHERE id = '5d1f2369-0241-40f8-89b4-15879dbdd766';

UPDATE public.services
SET image_url = '/images/services/051-ombre.webp',
    image_alt = 'Ombre service at Cradle Massage and Wellness Spa'
WHERE id = '39a204a6-33a4-4f01-96df-b04d32ce19bb';

UPDATE public.services
SET image_url = '/images/services/052-power-dose-power-mix-long-hair.webp',
    image_alt = 'Power Dose / Power Mix Long Hair service at Cradle Massage and Wellness Spa'
WHERE id = '91f6e983-30ec-483e-b014-31f22d697352';

UPDATE public.services
SET image_url = '/images/services/053-power-dose-power-mix-medium-hair.webp',
    image_alt = 'Power Dose / Power Mix Medium Hair service at Cradle Massage and Wellness Spa'
WHERE id = '337a8f6f-846a-4aee-beb7-429648814737';

UPDATE public.services
SET image_url = '/images/services/054-power-dose-power-mix-short-hair.webp',
    image_alt = 'Power Dose / Power Mix Short Hair service at Cradle Massage and Wellness Spa'
WHERE id = '98f8b6a6-d5e8-45d1-9239-0bded597d9aa';

UPDATE public.services
SET image_url = '/images/services/055-shampoo-only.webp',
    image_alt = 'Shampoo Only service at Cradle Massage and Wellness Spa'
WHERE id = '1404bae5-7df1-4fea-9926-ea29f1e0d0be';

UPDATE public.services
SET image_url = '/images/services/056-shampoo-with-blowdry.webp',
    image_alt = 'Shampoo with Blowdry service at Cradle Massage and Wellness Spa'
WHERE id = '1a7b4033-0a96-4b96-95d1-f443869b34b2';

UPDATE public.services
SET image_url = '/images/services/057-waxing-bikini.webp',
    image_alt = 'Waxing Bikini service at Cradle Massage and Wellness Spa'
WHERE id = '06c35fe4-7329-4656-84c7-a4deb9918e50';

UPDATE public.services
SET image_url = '/images/services/058-waxing-facial-eyebrows-beard-nape.webp',
    image_alt = 'Waxing Facial / Eyebrows / Beard / Nape service at Cradle Massage and Wellness Spa'
WHERE id = '8a1c9549-7ce9-41ad-9ab1-6ca6fdb6d5c3';

UPDATE public.services
SET image_url = '/images/services/059-waxing-legs-calf.webp',
    image_alt = 'Waxing Legs Calf service at Cradle Massage and Wellness Spa'
WHERE id = '218e2dae-2e5d-4e99-86d0-3e7a7bed3787';

UPDATE public.services
SET image_url = '/images/services/060-waxing-underarm.webp',
    image_alt = 'Waxing Underarm service at Cradle Massage and Wellness Spa'
WHERE id = '7200c191-cd38-4ebc-a9f4-0acc7adb5b48';

UPDATE public.services
SET image_url = '/images/services/061-aqua-facial.webp',
    image_alt = 'Aqua Facial service at Cradle Massage and Wellness Spa'
WHERE id = '72ac050b-c189-4d14-9cf1-79ccfecda402';

UPDATE public.services
SET image_url = '/images/services/062-bio-skin-lift-with-pdt-light.webp',
    image_alt = 'Bio Skin Lift with PDT Light service at Cradle Massage and Wellness Spa'
WHERE id = '6adbc7e5-37b9-4b08-bb44-ea2fed1af234';

UPDATE public.services
SET image_url = '/images/services/063-carbon-laser-treatment-face-area.webp',
    image_alt = 'Carbon Laser Treatment Face Area service at Cradle Massage and Wellness Spa'
WHERE id = '856345b3-91fc-4158-ac12-ab450ff40d30';

UPDATE public.services
SET image_url = '/images/services/064-carbon-laser-treatment-face-area-with-pdt-package.webp',
    image_alt = 'Carbon Laser Treatment Face Area with PDT Package service at Cradle Massage and Wellness Spa'
WHERE id = '02aedf77-d639-44c6-8f5b-9f3d712dff68';

UPDATE public.services
SET image_url = '/images/services/065-carbon-laser-treatment-underarm-area.webp',
    image_alt = 'Carbon Laser Treatment Underarm Area service at Cradle Massage and Wellness Spa'
WHERE id = 'a2f6cedb-0835-4679-848e-1413e17e033f';

UPDATE public.services
SET image_url = '/images/services/066-diode-laser-arm.webp',
    image_alt = 'Diode Laser Arm service at Cradle Massage and Wellness Spa'
WHERE id = 'ac06609f-5c1d-411e-bfc1-f717f710cfbf';

UPDATE public.services
SET image_url = '/images/services/067-diode-laser-beard.webp',
    image_alt = 'Diode Laser Beard service at Cradle Massage and Wellness Spa'
WHERE id = '95c32dea-ed5c-4186-9ae7-566f66d88ef3';

UPDATE public.services
SET image_url = '/images/services/068-diode-laser-chest.webp',
    image_alt = 'Diode Laser Chest service at Cradle Massage and Wellness Spa'
WHERE id = '41050127-c675-46b7-b20e-92f73c8de493';

UPDATE public.services
SET image_url = '/images/services/069-diode-laser-legs.webp',
    image_alt = 'Diode Laser Legs service at Cradle Massage and Wellness Spa'
WHERE id = '5974dbc3-7669-4fd2-871a-7fa39625aa52';

UPDATE public.services
SET image_url = '/images/services/070-diode-laser-mustache.webp',
    image_alt = 'Diode Laser Mustache service at Cradle Massage and Wellness Spa'
WHERE id = '8ed05c20-755a-40b4-a5e1-a524e247a5d3';

UPDATE public.services
SET image_url = '/images/services/071-diode-laser-underarm.webp',
    image_alt = 'Diode Laser Underarm service at Cradle Massage and Wellness Spa'
WHERE id = '62a1c64b-141f-4024-af00-09ab170d2079';

UPDATE public.services
SET image_url = '/images/services/072-diode-laser-upper-lower-lip.webp',
    image_alt = 'Diode Laser Upper / Lower Lip service at Cradle Massage and Wellness Spa'
WHERE id = '8c3f7cd1-cdb0-4ed4-a7ae-f65775dedd4f';

UPDATE public.services
SET image_url = '/images/services/073-diode-laser-whole-body.webp',
    image_alt = 'Diode Laser Whole Body service at Cradle Massage and Wellness Spa'
WHERE id = '1ceb46dd-db56-466e-a295-24dd1cc19a17';

UPDATE public.services
SET image_url = '/images/services/074-diode-laser-whole-face.webp',
    image_alt = 'Diode Laser Whole Face service at Cradle Massage and Wellness Spa'
WHERE id = '7af8bf0b-e556-4677-811e-40ff8239b81b';

UPDATE public.services
SET image_url = '/images/services/075-facial-cleansing-with-mask.webp',
    image_alt = 'Facial Cleansing with Mask service at Cradle Massage and Wellness Spa'
WHERE id = '846bb7a9-18ff-43fb-b813-2dd717dc1c62';

UPDATE public.services
SET image_url = '/images/services/076-filipino-coffee-body-scrub.webp',
    image_alt = 'Filipino Coffee Body Scrub service at Cradle Massage and Wellness Spa'
WHERE id = '745296d7-5e91-4c4c-a2c8-ff75cfea11ec';

UPDATE public.services
SET image_url = '/images/services/077-hydra-dermabrasion-plus-oxy-jet.webp',
    image_alt = 'Hydra Dermabrasion + Oxy Jet service at Cradle Massage and Wellness Spa'
WHERE id = '07636e4d-67cf-4472-9279-16e4f98fd3c1';

UPDATE public.services
SET image_url = '/images/services/078-hydra-dermabrasion-plus-oxy-jet-with-pdt-light.webp',
    image_alt = 'Hydra Dermabrasion + Oxy Jet with PDT Light service at Cradle Massage and Wellness Spa'
WHERE id = '062bdecc-4e3c-4832-8a8c-5556477af2a3';

UPDATE public.services
SET image_url = '/images/services/079-hydra-facial.webp',
    image_alt = 'Hydra Facial service at Cradle Massage and Wellness Spa'
WHERE id = '2e52f9e6-1df0-455b-916b-e81cecafbd4e';

UPDATE public.services
SET image_url = '/images/services/080-hydra-facial-with-pdt-package.webp',
    image_alt = 'Hydra Facial with PDT Package service at Cradle Massage and Wellness Spa'
WHERE id = '5c95b631-bad9-4f5e-bbee-1d5fe7db0cbb';

UPDATE public.services
SET image_url = '/images/services/081-korean-glass-skin-facial.webp',
    image_alt = 'Korean Glass Skin Facial service at Cradle Massage and Wellness Spa'
WHERE id = '963e5177-44c1-4439-b26e-034948157615';

UPDATE public.services
SET image_url = '/images/services/082-lemon-body-scrub.webp',
    image_alt = 'Lemon Body Scrub service at Cradle Massage and Wellness Spa'
WHERE id = '715c212c-ca8f-4e7c-aa9f-b1632e665f44';

UPDATE public.services
SET image_url = '/images/services/083-medium-size-tattoo-removal.webp',
    image_alt = 'Medium Size Tattoo Removal service at Cradle Massage and Wellness Spa'
WHERE id = '9130022c-0dad-472f-ad08-f70fb418e71c';

UPDATE public.services
SET image_url = '/images/services/084-organic-facial-cleansing-with-mask.webp',
    image_alt = 'Organic Facial Cleansing with Mask service at Cradle Massage and Wellness Spa'
WHERE id = '9d57c5dd-0b6c-4137-9949-ea2df9ecfdfe';

UPDATE public.services
SET image_url = '/images/services/085-oxy-jet-peel-facial.webp',
    image_alt = 'Oxy Jet Peel Facial service at Cradle Massage and Wellness Spa'
WHERE id = '080db9ad-a8b5-41d1-9818-2175bf4eb2b5';

UPDATE public.services
SET image_url = '/images/services/086-pdt-light.webp',
    image_alt = 'PDT Light service at Cradle Massage and Wellness Spa'
WHERE id = '068283b0-090e-4082-bccf-86af8e1728bf';

UPDATE public.services
SET image_url = '/images/services/087-pico-plus-whitening-underarm-package.webp',
    image_alt = 'Pico + Whitening Underarm Package service at Cradle Massage and Wellness Spa'
WHERE id = '1aa024f7-be0a-4d72-888f-3d77b72a85e3';

UPDATE public.services
SET image_url = '/images/services/088-pico-tattoo-2-in-1-face.webp',
    image_alt = 'Pico Tattoo 2 in 1 Face service at Cradle Massage and Wellness Spa'
WHERE id = '3f1defd5-dcf6-48dd-95dc-480cedff16df';

UPDATE public.services
SET image_url = '/images/services/089-pico-tattoo-2-in-1-underarm.webp',
    image_alt = 'Pico Tattoo 2 in 1 Underarm service at Cradle Massage and Wellness Spa'
WHERE id = '5517ddfb-7e58-42ef-b651-37826e6f65e0';

UPDATE public.services
SET image_url = '/images/services/090-tattoo-removal-below-3x3-or-2x4-inches.webp',
    image_alt = 'Tattoo Removal Below 3x3 or 2x4 inches service at Cradle Massage and Wellness Spa'
WHERE id = 'a22e4a72-3f3b-401f-9451-53293968fa84';

UPDATE public.services
SET image_url = '/images/services/091-celestial-glow-package.webp',
    image_alt = 'Celestial Glow Package service at Cradle Massage and Wellness Spa'
WHERE id = '600f2065-5d8e-45b4-9c32-4691d6e053ba';

UPDATE public.services
SET image_url = '/images/services/092-divine-renewal-package.webp',
    image_alt = 'Divine Renewal Package service at Cradle Massage and Wellness Spa'
WHERE id = '68b3cebe-1792-482e-8507-f263e3afe0b2';

UPDATE public.services
SET image_url = '/images/services/093-halo-massage-escape.webp',
    image_alt = 'Halo Massage Escape service at Cradle Massage and Wellness Spa'
WHERE id = 'a972c29c-9f0a-4d17-8acb-1dd4b273e43a';

UPDATE public.services
SET image_url = '/images/services/094-heavenly-harmony-couples-or-besties-spa.webp',
    image_alt = 'Heavenly Harmony Couples or Besties Spa service at Cradle Massage and Wellness Spa'
WHERE id = '1cd8af37-6eef-4225-89ee-5bf339b540bf';

UPDATE public.services
SET image_url = '/images/services/095-seraphic-beauty-ritual.webp',
    image_alt = 'Seraphic Beauty Ritual service at Cradle Massage and Wellness Spa'
WHERE id = '92192837-1217-48d2-ac25-d42f714e519f';

UPDATE public.services
SET image_url = '/images/services/096-serenity-soles.webp',
    image_alt = 'Serenity Soles service at Cradle Massage and Wellness Spa'
WHERE id = 'a9ba7f2a-52a5-4f76-8bc0-ac0ff315f8db';

UPDATE public.services
SET image_url = '/images/services/097-tranquil-touch-package.webp',
    image_alt = 'Tranquil Touch Package service at Cradle Massage and Wellness Spa'
WHERE id = '976200d2-d9db-4d07-b144-e5c0ecb665b7';

UPDATE public.services
SET image_url = '/images/services/098-weekday-wind-down.webp',
    image_alt = 'Weekday Wind Down service at Cradle Massage and Wellness Spa'
WHERE id = '0d9fb6c6-d712-4706-ad1a-db8f46ddbf7f';

UPDATE public.services
SET image_url = '/images/services/099-aquamarine-package.webp',
    image_alt = 'Aquamarine Package service at Cradle Massage and Wellness Spa'
WHERE id = '75481988-6cbb-4be7-8f1e-f385180c007a';

UPDATE public.services
SET image_url = '/images/services/100-peridot-package.webp',
    image_alt = 'Peridot Package service at Cradle Massage and Wellness Spa'
WHERE id = '0629ef89-8b5b-46a5-93f6-701f6a1bc259';

COMMIT;
